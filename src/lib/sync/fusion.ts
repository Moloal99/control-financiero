import type { Datos } from '../../types'

/**
 * Fusión de datos entre dispositivos sin perder registros.
 *
 * Cada registro (gasto, movimiento, categoría, cuenta, fondo, fijo, escenario, método) se identifica por
 * "colección:id". El registro de cambios guarda cuándo se modificó o eliminó cada uno en este dispositivo.
 * Al fusionar dos copias gana, registro por registro, la versión más reciente (o el borrado, si es posterior).
 */

export const COLECCIONES = ['categorias', 'metodos', 'cuentas', 'fondos', 'gastos', 'movimientos', 'recurrentes', 'escenarios'] as const
export type Coleccion = (typeof COLECCIONES)[number]
const AJUSTES = 'ajustes'

export interface RegistroCambios {
  /** Momento (ms) de la última modificación de cada registro. */
  mod: Record<string, number>
  /** Momento (ms) en que se eliminó cada registro. */
  borrados: Record<string, number>
}

export const registroVacio = (): RegistroCambios => ({ mod: {}, borrados: {} })

const clave = (c: string, id: string) => `${c}:${id}`
type ConId = { id: string }

function porId<T extends ConId>(lista: T[]): Map<string, T> {
  return new Map(lista.filter((x) => x && typeof x.id === 'string').map((x) => [x.id, x]))
}

/** Anota qué registros cambiaron, se agregaron o se eliminaron entre dos estados. */
export function registrarCambios(antes: Datos, despues: Datos, reg: RegistroCambios, ahora = Date.now()): RegistroCambios {
  const mod = { ...reg.mod }
  const borrados = { ...reg.borrados }
  let cambio = false
  for (const c of COLECCIONES) {
    if (antes[c] === despues[c]) continue
    const a = porId(antes[c] as ConId[])
    const d = porId(despues[c] as ConId[])
    for (const [id, x] of d) {
      const previo = a.get(id)
      if (previo === x) continue
      if (!previo || JSON.stringify(previo) !== JSON.stringify(x)) {
        mod[clave(c, id)] = ahora
        delete borrados[clave(c, id)]
        cambio = true
      }
    }
    for (const id of a.keys())
      if (!d.has(id)) {
        borrados[clave(c, id)] = ahora
        cambio = true
      }
  }
  if (antes.ajustes !== despues.ajustes && JSON.stringify(antes.ajustes) !== JSON.stringify(despues.ajustes)) {
    mod[AJUSTES] = ahora
    cambio = true
  }
  return cambio ? { mod, borrados } : reg
}

/** Marca todo lo que hay como conocido en este momento (al conectar un dispositivo que ya tenía datos). */
export function sellarTodo(d: Datos, reg: RegistroCambios, ahora = Date.now()): RegistroCambios {
  const mod = { ...reg.mod }
  for (const c of COLECCIONES) for (const x of d[c] as ConId[]) mod[clave(c, x.id)] ??= ahora
  mod[AJUSTES] ??= ahora
  return { mod, borrados: { ...reg.borrados } }
}

/** Un dispositivo recién instalado: solo tiene la configuración inicial y nunca registró cambios. */
export function esVirgen(d: Datos, reg: RegistroCambios): boolean {
  return d.gastos.length + d.movimientos.length === 0 && Object.keys(reg.mod).length === 0 && Object.keys(reg.borrados).length === 0
}

export interface Copia {
  datos: Datos
  registro: RegistroCambios
}

/** Fusiona la copia de este dispositivo con la de Drive. Ninguna de las dos se modifica. */
export function fusionar(local: Copia, remoto: Copia): Copia & { cambiosLocales: number; cambiosRemotos: number } {
  const mod: Record<string, number> = { ...remoto.registro.mod }
  for (const [k, t] of Object.entries(local.registro.mod)) mod[k] = Math.max(mod[k] ?? 0, t)
  const borrados: Record<string, number> = { ...remoto.registro.borrados }
  for (const [k, t] of Object.entries(local.registro.borrados)) borrados[k] = Math.max(borrados[k] ?? 0, t)

  let cambiosLocales = 0 // lo que este dispositivo recibe
  let cambiosRemotos = 0 // lo que Drive recibe
  const datos = { ...local.datos } as Datos
  for (const c of COLECCIONES) {
    const l = porId(local.datos[c] as ConId[])
    const r = porId(remoto.datos[c] as ConId[])
    // Orden: el de este dispositivo y, al final, lo nuevo que llega de Drive.
    const ids = [...l.keys(), ...[...r.keys()].filter((id) => !l.has(id))]
    const out: ConId[] = []
    for (const id of ids) {
      const k = clave(c, id)
      const lx = l.get(id)
      const rx = r.get(id)
      const tl = lx ? (local.registro.mod[k] ?? 0) : -1
      const tr = rx ? (remoto.registro.mod[k] ?? 0) : -1
      const tb = Math.max(local.registro.borrados[k] ?? -1, remoto.registro.borrados[k] ?? -1)
      // Versión más reciente entre las presentes; en empate se queda la de este dispositivo.
      const elegido = lx && (!rx || tl >= tr) ? lx : rx
      const tElegido = elegido === lx ? tl : tr
      if (!elegido || tb > tElegido) {
        if (lx) cambiosLocales++
        if (rx) cambiosRemotos++
        continue
      }
      out.push(elegido)
      if (elegido !== lx && (!lx || JSON.stringify(lx) !== JSON.stringify(rx))) cambiosLocales++
      if (elegido !== rx && (!rx || JSON.stringify(lx) !== JSON.stringify(rx))) cambiosRemotos++
    }
    ;(datos as unknown as Record<string, unknown>)[c] = out
  }
  const ta = local.registro.mod[AJUSTES] ?? 0
  const tra = remoto.registro.mod[AJUSTES] ?? 0
  if (tra > ta && remoto.datos.ajustes) {
    datos.ajustes = remoto.datos.ajustes
    if (JSON.stringify(remoto.datos.ajustes) !== JSON.stringify(local.datos.ajustes)) cambiosLocales++
  } else if (JSON.stringify(remoto.datos.ajustes) !== JSON.stringify(local.datos.ajustes)) cambiosRemotos++

  // Los borrados que ya perdieron contra una modificación posterior dejan de importar.
  for (const [k, t] of Object.entries(borrados)) if ((mod[k] ?? 0) > t) delete borrados[k]
  return { datos, registro: { mod, borrados }, cambiosLocales, cambiosRemotos }
}
