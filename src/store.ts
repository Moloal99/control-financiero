import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Ajustes, Categoria, Cuenta, Datos, Escenario, Fondo, Gasto, MetodoPago, Movimiento, Recurrente } from './types'
import { datosIniciales } from './lib/seed'
import { hoyISO, uid } from './lib/format'
import { VERSION_DATOS, migrar, normalizar } from './lib/migrar'
import { ocurrenciasPendientes, registroDeRecurrente } from './lib/calc'

type Sin<T> = Omit<T, 'id'>

export const CLAVE_DATOS = 'control-financiero-v1'
export const CLAVE_RESPALDO_MIGRACION = 'control-financiero-respaldo-antes-v2'
export const CLAVE_AVISO_MIGRACION = 'control-financiero-aviso-migracion'
export const CLAVE_RECUPERACION = 'control-financiero-recuperacion'

/** Si se borra el registro de un fijo automático, ese mes queda omitido para que no se vuelva a registrar solo. */
function omitirSiAuto(recs: Recurrente[], id: string | null | undefined, fecha: string | undefined): Recurrente[] {
  if (!id || !fecha) return recs
  const mes = fecha.slice(0, 7)
  return recs.map((r) => (r.id === id && r.auto && !(r.omitidos ?? []).includes(mes) ? { ...r, omitidos: [...(r.omitidos ?? []), mes] } : r))
}

interface Acciones {
  agregarGasto: (g: Sin<Gasto>) => string
  editarGasto: (id: string, g: Partial<Gasto>) => void
  eliminarGasto: (id: string) => void
  agregarMovimiento: (m: Sin<Movimiento>) => string
  agregarMovimientos: (ms: Sin<Movimiento>[]) => string[]
  editarMovimiento: (id: string, m: Partial<Movimiento>) => void
  eliminarMovimiento: (id: string) => void
  guardarCategoria: (c: Categoria) => void
  eliminarCategoria: (id: string) => void
  guardarMetodo: (m: MetodoPago) => void
  eliminarMetodo: (id: string) => void
  guardarCuenta: (c: Cuenta) => void
  eliminarCuenta: (id: string) => void
  guardarFondo: (f: Fondo) => void
  eliminarFondo: (id: string) => void
  guardarRecurrente: (r: Recurrente) => void
  eliminarRecurrente: (id: string) => void
  /** Registra la ocurrencia de un recurrente en la fecha dada. Devuelve el id del registro creado. */
  registrarRecurrente: (id: string, fecha: string) => string | null
  /** Registra los recurrentes automáticos vencidos que falten. Devuelve cuántos registró. */
  aplicarRecurrentesAutomaticos: (hoy: string) => number
  guardarEscenario: (e: Escenario) => void
  eliminarEscenario: (id: string) => void
  setAjustes: (a: Partial<Ajustes>) => void
  reemplazarTodo: (d: Datos) => void
  restablecer: () => void
}

export type Store = Datos & Acciones

const upsert = <T extends { id: string }>(arr: T[], item: T): T[] =>
  arr.some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item]

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...datosIniciales(),
      agregarGasto: (g) => {
        const id = uid()
        set((s) => ({ gastos: [...s.gastos, { ...g, id }] }))
        return id
      },
      editarGasto: (id, g) => set((s) => ({ gastos: s.gastos.map((x) => (x.id === id ? { ...x, ...g } : x)) })),
      eliminarGasto: (id) =>
        set((s) => {
          const g = s.gastos.find((x) => x.id === id)
          return { gastos: s.gastos.filter((x) => x.id !== id), recurrentes: omitirSiAuto(s.recurrentes, g?.recurrenteId, g?.fecha) }
        }),
      agregarMovimiento: (m) => {
        const id = uid()
        set((s) => ({ movimientos: [...s.movimientos, { ...m, id }] }))
        return id
      },
      agregarMovimientos: (ms) => {
        const nuevos = ms.map((m) => ({ ...m, id: uid() }))
        set((s) => ({ movimientos: [...s.movimientos, ...nuevos] }))
        return nuevos.map((m) => m.id)
      },
      editarMovimiento: (id, m) => set((s) => ({ movimientos: s.movimientos.map((x) => (x.id === id ? { ...x, ...m } : x)) })),
      eliminarMovimiento: (id) =>
        set((s) => {
          const m = s.movimientos.find((x) => x.id === id)
          return { movimientos: s.movimientos.filter((x) => x.id !== id), recurrentes: omitirSiAuto(s.recurrentes, m?.recurrenteId, m?.fecha) }
        }),
      guardarCategoria: (c) => set((s) => ({ categorias: upsert(s.categorias, c) })),
      eliminarCategoria: (id) =>
        set((s) => ({
          categorias: s.categorias.filter((x) => x.id !== id),
          gastos: s.gastos.map((g) => (g.categoriaId === id ? { ...g, categoriaId: '' } : g)),
          recurrentes: s.recurrentes.map((r) => (r.categoriaId === id ? { ...r, categoriaId: null } : r)),
        })),
      guardarMetodo: (m) => set((s) => ({ metodos: upsert(s.metodos, m) })),
      eliminarMetodo: (id) =>
        set((s) => ({
          metodos: s.metodos.filter((x) => x.id !== id),
          gastos: s.gastos.map((g) => (g.metodoId === id ? { ...g, metodoId: null } : g)),
          recurrentes: s.recurrentes.map((r) => (r.metodoId === id ? { ...r, metodoId: null } : r)),
        })),
      guardarCuenta: (c) => set((s) => ({ cuentas: upsert(s.cuentas, c) })),
      eliminarCuenta: (id) =>
        set((s) => ({
          cuentas: s.cuentas.filter((x) => x.id !== id),
          fondos: s.fondos.map((f) => (f.cuentaId === id ? { ...f, cuentaId: null } : f)),
          gastos: s.gastos.map((g) => (g.cuentaId === id ? { ...g, cuentaId: null } : g)),
          movimientos: s.movimientos.map((m) => ({
            ...m,
            cuentaOrigenId: m.cuentaOrigenId === id ? null : m.cuentaOrigenId,
            cuentaDestinoId: m.cuentaDestinoId === id ? null : m.cuentaDestinoId,
          })),
          recurrentes: s.recurrentes.map((r) => (r.cuentaId === id ? { ...r, cuentaId: null } : r)),
        })),
      guardarFondo: (f) => set((s) => ({ fondos: upsert(s.fondos, f) })),
      eliminarFondo: (id) =>
        set((s) => ({
          fondos: s.fondos.filter((x) => x.id !== id),
          gastos: s.gastos.map((g) => (g.fondoId === id ? { ...g, fondoId: null } : g)),
          movimientos: s.movimientos.map((m) => {
            const reparto = m.reparto && id in m.reparto ? Object.fromEntries(Object.entries(m.reparto).filter(([k]) => k !== id)) : m.reparto
            return {
              ...m,
              reparto,
              fondoOrigenId: m.fondoOrigenId === id ? null : m.fondoOrigenId,
              fondoDestinoId: m.fondoDestinoId === id ? null : m.fondoDestinoId,
            }
          }),
          recurrentes: s.recurrentes.map((r) => (r.fondoId === id ? { ...r, fondoId: null } : r)),
          escenarios: s.escenarios.map((e) => ({
            ...e,
            aporteFondoId: e.aporteFondoId === id ? null : e.aporteFondoId,
            compras: e.compras.map((c) => (c.fondoId === id ? { ...c, fondoId: null } : c)),
          })),
        })),
      guardarRecurrente: (r) => set((s) => ({ recurrentes: upsert(s.recurrentes, { ...r, creado: r.creado ?? hoyISO(), omitidos: r.omitidos ?? [] }) })),
      eliminarRecurrente: (id) =>
        set((s) => ({
          recurrentes: s.recurrentes.filter((x) => x.id !== id),
          gastos: s.gastos.map((g) => (g.recurrenteId === id ? { ...g, recurrenteId: null } : g)),
          movimientos: s.movimientos.map((m) => (m.recurrenteId === id ? { ...m, recurrenteId: null } : m)),
        })),
      registrarRecurrente: (id, fecha) => {
        const r = get().recurrentes.find((x) => x.id === id)
        if (!r) return null
        const reg = registroDeRecurrente(r, fecha, get().fondos)
        if (reg.tipo === 'gasto') return get().agregarGasto(reg.gasto)
        return get().agregarMovimiento(reg.movimiento)
      },
      aplicarRecurrentesAutomaticos: (hoy) => {
        // Solo desde que se creó el fijo: no rellena meses anteriores.
        const pendientes = ocurrenciasPendientes(get(), hoy).filter((p) => p.recurrente.auto && p.fecha <= hoy && p.fecha >= (p.recurrente.creado ?? '0000-01-01'))
        for (const p of pendientes) get().registrarRecurrente(p.recurrente.id, p.fecha)
        return pendientes.length
      },
      guardarEscenario: (e) => set((s) => ({ escenarios: upsert(s.escenarios, e) })),
      eliminarEscenario: (id) => set((s) => ({ escenarios: s.escenarios.filter((x) => x.id !== id) })),
      setAjustes: (a) => set((s) => ({ ajustes: { ...s.ajustes, ...a } })),
      reemplazarTodo: (d) => set(() => ({ ...normalizar(d) })),
      restablecer: () => set(() => ({ ...datosIniciales() })),
    }),
    {
      name: CLAVE_DATOS,
      version: VERSION_DATOS,
      partialize: (s) => exportarDatos(s),
      migrate: (persistido, version) => {
        // Antes de transformar, se guarda una copia exacta para poder volver atrás desde "Importar y exportar".
        try {
          if (version < VERSION_DATOS) {
            localStorage.setItem(CLAVE_RESPALDO_MIGRACION, JSON.stringify({ version, guardado: new Date().toISOString(), datos: persistido }))
          }
        } catch {
          /* sin almacenamiento disponible */
        }
        let resultado: ReturnType<typeof migrar>
        try {
          resultado = migrar(persistido, version)
        } catch (e) {
          try {
            localStorage.setItem(CLAVE_RECUPERACION, JSON.stringify({ guardado: new Date().toISOString(), error: String(e), datos: persistido }))
          } catch {
            /* sin almacenamiento */
          }
          resultado = { datos: datosIniciales(), informe: null }
        }
        const { datos, informe } = resultado
        try {
          if (informe) localStorage.setItem(CLAVE_AVISO_MIGRACION, JSON.stringify(informe))
        } catch {
          /* sin almacenamiento disponible */
        }
        return datos as unknown as Store
      },
      merge: (persistido, actual) => {
        try {
          return { ...actual, ...normalizar(persistido ?? exportarDatos(actual)) }
        } catch (e) {
          // Si los datos guardados no se pueden leer, se conserva una copia exacta antes de que se sobrescriban.
          try {
            localStorage.setItem(CLAVE_RECUPERACION, JSON.stringify({ guardado: new Date().toISOString(), error: String(e), datos: persistido }))
          } catch {
            /* sin almacenamiento */
          }
          return actual
        }
      },
    },
  ),
)

export function exportarDatos(s: Datos): Datos {
  return {
    categorias: s.categorias,
    metodos: s.metodos,
    cuentas: s.cuentas,
    fondos: s.fondos,
    gastos: s.gastos,
    movimientos: s.movimientos,
    recurrentes: s.recurrentes,
    escenarios: s.escenarios,
    ajustes: s.ajustes,
  }
}
