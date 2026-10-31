import { create } from 'zustand'
import type { Gasto, Movimiento } from '../types'
import type { Vista } from '../components/Layout'

export type PestanaRegistro = 'gasto' | 'ingreso' | 'mover'
export type SubPlan = 'presupuesto' | 'fijos' | 'proyeccion'
export type SubAnalisis = 'tendencias' | 'patrimonio' | 'cierre'

export interface AperturaRegistro {
  pestana?: PestanaRegistro
  gasto?: Gasto | null
  movimiento?: Movimiento | null
  /** Valores iniciales para un ingreso o movimiento nuevo (por ejemplo, mover desde "sin asignar"). */
  preset?: Partial<Movimiento> | null
  /** Valores iniciales para un gasto nuevo (por ejemplo, un fijo con otro monto). */
  presetGasto?: Partial<Gasto> | null
}

interface UIState {
  registro: AperturaRegistro | null
  pagate: { cuentaId?: string | null } | null
  alertas: boolean
  subPlan: SubPlan
  subAnalisis: SubAnalisis
  abrirRegistro: (a?: AperturaRegistro) => void
  cerrarRegistro: () => void
  abrirPagate: (cuentaId?: string | null) => void
  cerrarPagate: () => void
  setAlertas: (v: boolean) => void
  setSubPlan: (s: SubPlan) => void
  setSubAnalisis: (s: SubAnalisis) => void
}

export const useUI = create<UIState>()((set) => ({
  registro: null,
  pagate: null,
  alertas: false,
  subPlan: 'presupuesto',
  subAnalisis: 'tendencias',
  abrirRegistro: (a = {}) => set({ registro: a }),
  cerrarRegistro: () => set({ registro: null }),
  abrirPagate: (cuentaId = null) => set({ pagate: { cuentaId } }),
  cerrarPagate: () => set({ pagate: null }),
  setAlertas: (v) => set({ alertas: v }),
  setSubPlan: (s) => set({ subPlan: s }),
  setSubAnalisis: (s) => set({ subAnalisis: s }),
}))

/** Navega a una vista (y opcionalmente a una pestaña interna). */
export function irA(v: Vista, sub?: SubPlan | SubAnalisis) {
  if (sub) {
    if (v === 'plan') useUI.getState().setSubPlan(sub as SubPlan)
    if (v === 'analisis') useUI.getState().setSubAnalisis(sub as SubAnalisis)
  }
  if (window.location.hash !== `#${v}`) window.location.hash = v
  else window.dispatchEvent(new HashChangeEvent('hashchange'))
  window.scrollTo({ top: 0 })
}
