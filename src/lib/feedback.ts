import { create } from 'zustand'

export type TonoToast = 'ok' | 'info' | 'warn' | 'bad'

export interface Toast {
  id: number
  texto: string
  detalle?: string
  tono: TonoToast
  accion?: { texto: string; onClick: () => void }
  duracion: number
}

export interface Confirmacion {
  titulo: string
  texto?: string
  aceptar?: string
  peligro?: boolean
  resolver: (ok: boolean) => void
}

interface FeedbackState {
  toasts: Toast[]
  confirmacion: Confirmacion | null
  cerrarToast: (id: number) => void
}

let seq = 0

export const useFeedback = create<FeedbackState>()((set) => ({
  toasts: [],
  confirmacion: null,
  cerrarToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Muestra un aviso breve en la parte inferior. */
export function toast(texto: string, opciones: Partial<Omit<Toast, 'id' | 'texto'>> = {}) {
  const t: Toast = { id: ++seq, texto, tono: 'ok', duracion: 3500, ...opciones }
  useFeedback.setState((s) => ({ toasts: [...s.toasts.slice(-2), t] }))
  if (t.duracion > 0) setTimeout(() => useFeedback.getState().cerrarToast(t.id), t.duracion)
  return t.id
}

/** Reemplazo de window.confirm con un diálogo propio. Devuelve true si el usuario acepta. */
export function confirmar(titulo: string, opciones: Omit<Confirmacion, 'titulo' | 'resolver'> = {}): Promise<boolean> {
  return new Promise((resolver) => {
    useFeedback.setState({
      confirmacion: {
        titulo,
        ...opciones,
        resolver: (ok) => {
          useFeedback.setState({ confirmacion: null })
          resolver(ok)
        },
      },
    })
  })
}

/** Vibración corta en celulares compatibles (confirmación táctil). */
export function vibrar(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* sin soporte */
  }
}
