import type { Datos } from '../types'

/**
 * Copias de seguridad automáticas dentro del dispositivo.
 *
 * Los datos viven en localStorage. Para no perderlos si esa copia se daña o se borra, cada día se guarda una foto
 * en IndexedDB (un almacén distinto) y se pide al navegador que no borre el almacenamiento de la app.
 */

const DB = 'control-financiero-copias'
const ALMACEN = 'copias'
const MAXIMO = 10
export const CLAVE_ULTIMO_RESPALDO = 'control-financiero-ultimo-respaldo'

export interface Copia {
  /** Fecha y hora ISO en que se guardó. */
  guardado: string
  origen: 'automatica' | 'antes-de-actualizar' | 'recuperacion'
  registros: number
  datos: unknown
}

export function contarRegistros(d: unknown): number {
  if (!d || typeof d !== 'object') return 0
  const x = d as { gastos?: unknown; movimientos?: unknown }
  return (Array.isArray(x.gastos) ? x.gastos.length : 0) + (Array.isArray(x.movimientos) ? x.movimientos.length : 0)
}

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(ALMACEN)) req.result.createObjectStore(ALMACEN, { keyPath: 'guardado' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function leerAutomaticas(): Promise<Copia[]> {
  const db = await abrir()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const req = db.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).getAll()
      req.onsuccess = () => resolve((req.result as Copia[]).sort((a, b) => b.guardado.localeCompare(a.guardado)))
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/** Guarda una foto de los datos si hoy aún no hay una (o si cambió mucho). Conserva las últimas copias. */
export async function guardarCopiaAutomatica(datos: Datos): Promise<void> {
  const registros = contarRegistros(datos)
  if (registros === 0) return
  const copias = await leerAutomaticas()
  const hoy = new Date().toISOString().slice(0, 10)
  const deHoy = copias.find((c) => c.guardado.slice(0, 10) === hoy)
  // Una copia por día; se renueva durante el día solo si no tiene menos registros que la actual (nunca se pisa una buena con una vacía).
  if (deHoy && deHoy.registros > registros) return
  const db = await abrir()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(ALMACEN, 'readwrite')
      const st = tx.objectStore(ALMACEN)
      if (deHoy) st.delete(deHoy.guardado)
      st.put({ guardado: new Date().toISOString(), origen: 'automatica', registros, datos: JSON.parse(JSON.stringify(datos)) } satisfies Copia)
      const sobrantes = copias.filter((c) => c !== deHoy).slice(MAXIMO - 1)
      for (const c of sobrantes) st.delete(c.guardado)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

function leerLocal(clave: string, origen: Copia['origen']): Copia | null {
  try {
    const t = localStorage.getItem(clave)
    if (!t) return null
    const x = JSON.parse(t) as { guardado?: string; datos?: unknown }
    if (!x?.datos) return null
    // El respaldo de antes de actualizar guarda el estado tal cual estaba (puede venir envuelto en { state }).
    const datos = (x.datos as { state?: unknown }).state ?? x.datos
    return { guardado: x.guardado ?? new Date(0).toISOString(), origen, registros: contarRegistros(datos), datos }
  } catch {
    return null
  }
}

/** Todas las copias que hay en este dispositivo, de la más reciente a la más antigua. */
export async function buscarCopias(clavesLocales: { recuperacion: string; antesDeActualizar: string }): Promise<Copia[]> {
  const locales = [leerLocal(clavesLocales.recuperacion, 'recuperacion'), leerLocal(clavesLocales.antesDeActualizar, 'antes-de-actualizar')].filter((c): c is Copia => Boolean(c && c.registros > 0))
  const auto = await leerAutomaticas()
  return [...locales, ...auto].sort((a, b) => b.guardado.localeCompare(a.guardado))
}

/** Pide al navegador que no borre los datos de la app cuando falta espacio o pasa tiempo sin usarla. */
export async function pedirAlmacenamientoPersistente(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

export function diasDesdeUltimoRespaldo(): number | null {
  try {
    const t = localStorage.getItem(CLAVE_ULTIMO_RESPALDO)
    if (!t) return null
    return Math.floor((Date.now() - new Date(t).getTime()) / 86_400_000)
  } catch {
    return null
  }
}

export function marcarRespaldoDescargado() {
  try {
    localStorage.setItem(CLAVE_ULTIMO_RESPALDO, new Date().toISOString())
  } catch {
    /* sin almacenamiento */
  }
}

export const NOMBRE_ORIGEN: Record<Copia['origen'], string> = {
  automatica: 'Copia automática',
  'antes-de-actualizar': 'Copia de antes de la actualización',
  recuperacion: 'Copia guardada tras un error al leer tus datos',
}
