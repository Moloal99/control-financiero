import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Ajustes, Categoria, Cuenta, Datos, Fondo, Gasto, MetodoPago, Movimiento } from './types'
import { datosIniciales } from './lib/seed'
import { uid } from './lib/format'

type Sin<T> = Omit<T, 'id'>

interface Acciones {
  agregarGasto: (g: Sin<Gasto>) => string
  editarGasto: (id: string, g: Partial<Gasto>) => void
  eliminarGasto: (id: string) => void
  agregarMovimiento: (m: Sin<Movimiento>) => string
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
  setAjustes: (a: Partial<Ajustes>) => void
  reemplazarTodo: (d: Datos) => void
  restablecer: () => void
}

export type Store = Datos & Acciones

const upsert = <T extends { id: string }>(arr: T[], item: T): T[] =>
  arr.some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item]

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...datosIniciales(),
      agregarGasto: (g) => {
        const id = uid()
        set((s) => ({ gastos: [...s.gastos, { ...g, id }] }))
        return id
      },
      editarGasto: (id, g) => set((s) => ({ gastos: s.gastos.map((x) => (x.id === id ? { ...x, ...g } : x)) })),
      eliminarGasto: (id) => set((s) => ({ gastos: s.gastos.filter((x) => x.id !== id) })),
      agregarMovimiento: (m) => {
        const id = uid()
        set((s) => ({ movimientos: [...s.movimientos, { ...m, id }] }))
        return id
      },
      editarMovimiento: (id, m) =>
        set((s) => ({ movimientos: s.movimientos.map((x) => (x.id === id ? { ...x, ...m } : x)) })),
      eliminarMovimiento: (id) => set((s) => ({ movimientos: s.movimientos.filter((x) => x.id !== id) })),
      guardarCategoria: (c) => set((s) => ({ categorias: upsert(s.categorias, c) })),
      eliminarCategoria: (id) =>
        set((s) => ({
          categorias: s.categorias.filter((x) => x.id !== id),
          gastos: s.gastos.map((g) => (g.categoriaId === id ? { ...g, categoriaId: '' } : g)),
        })),
      guardarMetodo: (m) => set((s) => ({ metodos: upsert(s.metodos, m) })),
      eliminarMetodo: (id) =>
        set((s) => ({
          metodos: s.metodos.filter((x) => x.id !== id),
          gastos: s.gastos.map((g) => (g.metodoId === id ? { ...g, metodoId: null } : g)),
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
        })),
      guardarFondo: (f) => set((s) => ({ fondos: upsert(s.fondos, f) })),
      eliminarFondo: (id) =>
        set((s) => ({
          fondos: s.fondos.filter((x) => x.id !== id),
          gastos: s.gastos.map((g) => (g.fondoId === id ? { ...g, fondoId: null } : g)),
        })),
      setAjustes: (a) => set((s) => ({ ajustes: { ...s.ajustes, ...a } })),
      reemplazarTodo: (d) => set(() => ({ ...d })),
      restablecer: () => set(() => ({ ...datosIniciales() })),
    }),
    {
      name: 'control-financiero-v1',
      partialize: (s) => ({
        categorias: s.categorias,
        metodos: s.metodos,
        cuentas: s.cuentas,
        fondos: s.fondos,
        gastos: s.gastos,
        movimientos: s.movimientos,
        ajustes: s.ajustes,
      }),
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
    ajustes: s.ajustes,
  }
}
