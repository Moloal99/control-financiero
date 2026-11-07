import { create } from 'zustand'
import { exportarDatos, useStore } from '../../store'
import { normalizar } from '../migrar'
import { toast } from '../feedback'
import type { Datos } from '../../types'
import { CLIENT_ID, SinPermiso, buscarArchivo, correoDeLaCuenta, guardarArchivo, iniciarSesion, leerArchivo, olvidarToken, procesarRetorno, tokenVigente } from './drive'
import { COLECCIONES, esVirgen, fusionar, registrarCambios, registroVacio, type RegistroCambios } from './fusion'

const CLAVE_CONFIG = 'control-financiero-sync'
const CLAVE_REGISTRO = 'control-financiero-sync-registro'

interface Config {
  activo: boolean
  correo?: string | null
  archivoId?: string | null
  ultima?: string | null
  /** Último intento de reconexión sin mostrar nada, para no repetirlo en bucle. */
  silencioso?: number
  /** La reconexión silenciosa falló: hace falta que el usuario toque "Conectar". */
  pideToque?: boolean
}

export type EstadoSync = 'sin-configurar' | 'apagado' | 'listo' | 'sincronizando' | 'pendiente' | 'reconectar' | 'error'

interface SyncState {
  estado: EstadoSync
  config: Config
  mensaje: string | null
  sincronizar: (op?: { avisar?: boolean }) => Promise<void>
  conectar: () => void
  desconectar: () => void
}

function leer<T>(clave: string, defecto: T): T {
  try {
    const t = localStorage.getItem(clave)
    return t ? (JSON.parse(t) as T) : defecto
  } catch {
    return defecto
  }
}
function escribir(clave: string, v: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(v))
  } catch {
    /* sin almacenamiento */
  }
}

let registro: RegistroCambios = leer(CLAVE_REGISTRO, registroVacio())
let revision = 0
let aplicandoRemoto = false
let enCurso: Promise<void> | null = null
let otraVez = false
let temporizador: number | undefined

type ArchivoRemoto = { datos?: unknown; registro?: RegistroCambios }

const estadoInicial = (c: Config): EstadoSync => (!CLIENT_ID ? 'sin-configurar' : !c.activo ? 'apagado' : tokenVigente() ? 'listo' : 'reconectar')

export const useSync = create<SyncState>()((set, get) => {
  const config0 = leer<Config>(CLAVE_CONFIG, { activo: false })
  const guardarConfig = (c: Partial<Config>) => {
    const config = { ...get().config, ...c }
    escribir(CLAVE_CONFIG, config)
    set({ config })
    return config
  }

  async function ronda(avisar: boolean): Promise<void> {
    const token = tokenVigente()
    if (!token) {
      set({ estado: 'reconectar', mensaje: null })
      return
    }
    set({ estado: 'sincronizando', mensaje: null })
    const revisionInicial = revision
    try {
      const cfg = get().config
      const correo = cfg.correo ?? (await correoDeLaCuenta(token))
      let id = cfg.archivoId ?? (await buscarArchivo(token))
      let remoto = null as ArchivoRemoto | null
      if (id) {
        try {
          remoto = (await leerArchivo(token, id)) as ArchivoRemoto
        } catch (e) {
          if (e instanceof SinPermiso) throw e
          // El archivo guardado ya no existe (se borró desde Drive): se busca otra vez o se crea uno nuevo.
          id = await buscarArchivo(token)
          remoto = id ? ((await leerArchivo(token, id)) as ArchivoRemoto) : null
        }
      }
      const local = { datos: exportarDatos(useStore.getState()), registro }
      let datos: Datos
      let reg: RegistroCambios
      let recibidos = 0
      let inicial = false
      let enviar = true
      if (remoto && remoto.datos) {
        const remotoN = { datos: normalizar(remoto.datos), registro: { ...registroVacio(), ...(remoto.registro ?? {}) } }
        if (esVirgen(local.datos, local.registro)) {
          // Teléfono o navegador nuevo: se toma todo lo que hay en Drive.
          datos = remotoN.datos
          reg = remotoN.registro
          recibidos = COLECCIONES.reduce((a, c) => a + (datos[c] as unknown[]).length, 0)
          inicial = true
          enviar = false
        } else {
          const f = fusionar(local, remotoN)
          datos = f.datos
          reg = f.registro
          recibidos = f.cambiosLocales
          enviar = f.cambiosRemotos > 0
        }
      } else {
        datos = local.datos
        reg = local.registro
      }
      // Si el usuario registró algo mientras tanto, se repite la ronda para no pisar ese cambio.
      if (revision !== revisionInicial) {
        otraVez = true
        return
      }
      if (recibidos > 0) {
        aplicandoRemoto = true
        try {
          useStore.getState().reemplazarTodo(datos)
        } finally {
          aplicandoRemoto = false
        }
      }
      registro = reg
      escribir(CLAVE_REGISTRO, registro)
      if (enviar || !id) {
        id = await guardarArchivo(token, id, { app: 'control-financiero', version: 1, guardado: new Date().toISOString(), datos: exportarDatos(useStore.getState()), registro })
      }
      guardarConfig({ archivoId: id, correo, ultima: new Date().toISOString(), pideToque: false })
      set({ estado: 'listo', mensaje: null })
      if (inicial) {
        const n = datos.gastos.length + datos.movimientos.length
        toast('Tus datos llegaron desde Google Drive', { detalle: `${n} ${n === 1 ? 'registro' : 'registros'} y toda tu configuración` })
      } else if (recibidos > 0) toast('Datos actualizados desde Google Drive', { tono: 'info', detalle: `${recibidos} ${recibidos === 1 ? 'cambio' : 'cambios'} de tus otros dispositivos` })
      else if (avisar) toast('Todo sincronizado', { detalle: correo ? `Con el Drive de ${correo}` : undefined })
    } catch (e) {
      if (e instanceof SinPermiso) {
        set({ estado: 'reconectar', mensaje: null })
        return
      }
      set({ estado: 'error', mensaje: (e as Error).message || 'Sin conexión' })
      if (avisar) toast('No se pudo sincronizar', { tono: 'info', detalle: navigator.onLine ? (e as Error).message : 'Sin conexión a internet. Se intentará de nuevo.' })
    }
  }

  return {
    estado: estadoInicial(config0),
    config: config0,
    mensaje: null,
    sincronizar: async (op = {}) => {
      if (!CLIENT_ID || !get().config.activo) return
      if (enCurso) {
        otraVez = true
        return enCurso
      }
      enCurso = (async () => {
        do {
          otraVez = false
          await ronda(Boolean(op.avisar))
        } while (otraVez && tokenVigente())
      })()
      try {
        await enCurso
      } finally {
        enCurso = null
      }
    },
    conectar: () => {
      guardarConfig({ activo: true, pideToque: false, silencioso: Date.now() })
      iniciarSesion({ correo: get().config.correo ?? undefined })
    },
    desconectar: () => {
      olvidarToken()
      guardarConfig({ activo: false, archivoId: null, pideToque: false })
      set({ estado: 'apagado', mensaje: null })
    },
  }
})

/** Anota cada cambio local y programa una sincronización. */
function vigilarCambios() {
  useStore.subscribe((s, previo) => {
    if (aplicandoRemoto) return
    const antes = exportarDatos(previo)
    const despues = exportarDatos(s)
    const nuevo = registrarCambios(antes, despues, registro)
    if (nuevo === registro) return
    registro = nuevo
    revision++
    escribir(CLAVE_REGISTRO, registro)
    const sync = useSync.getState()
    if (!sync.config.activo || !CLIENT_ID) return
    if (sync.estado === 'listo' || sync.estado === 'error') useSync.setState({ estado: 'pendiente' })
    window.clearTimeout(temporizador)
    temporizador = window.setTimeout(() => void useSync.getState().sincronizar(), 2500)
  })
}

/** Si el permiso venció, se renueva sin mostrar nada (Google vuelve solo a la app). Como mucho cada 20 minutos. */
function renovarSiHaceFalta(): boolean {
  const { config } = useSync.getState()
  if (!CLIENT_ID || !config.activo || tokenVigente() || config.pideToque || !navigator.onLine) return false
  if (Date.now() - (config.silencioso ?? 0) < 20 * 60_000) return false
  const c = { ...config, silencioso: Date.now() }
  escribir(CLAVE_CONFIG, c)
  iniciarSesion({ silencioso: true, correo: config.correo ?? undefined })
  return true
}

/**
 * Se llama una vez antes de dibujar la app. Procesa la vuelta desde Google y deja todo listo.
 * Devuelve false si la página se va a Google a renovar el permiso (no hace falta dibujar nada).
 */
export function iniciarSync(): boolean {
  const retorno = procesarRetorno()
  if (retorno) {
    const config = leer<Config>(CLAVE_CONFIG, { activo: false })
    if (retorno.ok) {
      escribir(CLAVE_CONFIG, { ...config, activo: true, pideToque: false })
      useSync.setState({ config: { ...config, activo: true, pideToque: false }, estado: 'listo' })
    } else {
      // Sin permiso guardado (o el usuario canceló): se pide tocar "Conectar".
      escribir(CLAVE_CONFIG, { ...config, pideToque: true })
      useSync.setState({ config: { ...config, pideToque: true }, estado: config.activo ? 'reconectar' : 'apagado' })
      if (!/interaction_required|login_required|consent_required/.test(retorno.error ?? '') && config.activo) {
        setTimeout(() => toast('No se pudo conectar con Google Drive', { tono: 'info', detalle: retorno.error }), 800)
      }
    }
  } else if (renovarSiHaceFalta()) {
    return false
  }
  vigilarCambios()
  const alVolver = () => {
    if (document.visibilityState !== 'visible') return
    if (renovarSiHaceFalta()) return
    const { config } = useSync.getState()
    if (config.activo && tokenVigente() && Date.now() - new Date(config.ultima ?? 0).getTime() > 30_000) void useSync.getState().sincronizar()
  }
  document.addEventListener('visibilitychange', alVolver)
  window.addEventListener('online', () => void useSync.getState().sincronizar())
  setTimeout(() => void useSync.getState().sincronizar({ avisar: Boolean(retorno?.ok) }), 300)
  return true
}
