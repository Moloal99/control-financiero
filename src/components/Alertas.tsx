import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { Alerta } from '../lib/calc'
import { irA } from '../lib/ui'
import { Empty } from './ui'

const ICONO_ALERTA = { bad: CircleAlert, warn: TriangleAlert, info: Info }
const COLOR_ALERTA = { bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--primary)' }

export function ListaAlertas({ alertas, onDescartar, onIr, max }: { alertas: Alerta[]; onDescartar: (id: string) => void; onIr?: () => void; max?: number }) {
  if (alertas.length === 0) return <Empty title="Todo en orden">No hay avisos por ahora.</Empty>
  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {alertas.slice(0, max).map((a) => {
          const Icono = ICONO_ALERTA[a.tono]
          return (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -30, height: 0 }}
              className="flex items-start gap-3 rounded-2xl px-3.5 py-3"
              style={{ background: `color-mix(in srgb, ${COLOR_ALERTA[a.tono]} 9%, transparent)` }}
            >
              <Icono size={18} className="shrink-0 mt-0.5" style={{ color: COLOR_ALERTA[a.tono] }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{a.titulo}</p>
                {a.detalle && <p className="text-xs text-muted mt-0.5 leading-snug">{a.detalle}</p>}
                <div className="flex gap-3 mt-1.5">
                  {a.destino && (
                    <button
                      className="text-xs font-bold text-primary inline-flex items-center gap-1"
                      onClick={() => {
                        onIr?.()
                        irA(a.destino!, a.destino === 'plan' && a.id.startsWith('rec-') ? 'fijos' : a.destino === 'plan' ? 'presupuesto' : undefined)
                      }}
                    >
                      Ver <ArrowRight size={12} />
                    </button>
                  )}
                  <button className="text-xs font-semibold text-muted" onClick={() => onDescartar(a.id)}>
                    Ocultar este mes
                  </button>
                </div>
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}
