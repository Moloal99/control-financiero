import { AnimatePresence, animate, motion, useDragControls, useReducedMotion, type DragControls, type PanInfo } from 'motion/react'
import { CircleAlert, CircleCheck, ChevronLeft, ChevronRight, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Estado } from '../types'
import { mesActual, nombreMes } from '../lib/format'
import { mesMas } from '../lib/calc'
import { useFeedback, type TonoToast } from '../lib/feedback'

/* ───────────────────────── Utilidades ───────────────────────── */

export function useEsMovil(query = '(max-width: 767px)'): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const f = (e: MediaQueryListEvent) => setM(e.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [query])
  return m
}

/** Resuelve un color expresado como var(--cN) a su valor computado (para SVG de gráficos). */
export function colorReal(c: string): string {
  const m = c.match(/^var\((--[\w-]+)\)$/)
  if (!m) return c
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
  return v || '#3d35b5'
}

const ease = [0.22, 1, 0.36, 1] as const

/* ───────────────────────── Superficies ───────────────────────── */

export function Card({
  title,
  subtitle,
  action,
  icon: Icono,
  children,
  className = '',
  padding = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  children: ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <section className={`card min-w-0 ${padding ? 'p-4 md:p-5' : ''} ${className}`}>
      {(title || action) && (
        <header className={`flex items-start justify-between gap-3 ${padding ? 'mb-4' : 'px-4 pt-4 md:px-5 md:pt-5 pb-1'}`}>
          <div className="flex items-start gap-2.5 min-w-0">
            {Icono && (
              <span className="mt-0.5 h-7 w-7 shrink-0 rounded-lg grid place-items-center bg-primary-soft text-primary">
                <Icono size={16} strokeWidth={2.2} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="font-bold text-[15px] md:text-base leading-tight tracking-tight">{title}</h2>}
              {subtitle && <p className="text-[13px] text-muted mt-0.5 leading-snug">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export type Tono = 'neutral' | 'ok' | 'warn' | 'bad' | 'primary'

const tonoTexto: Record<Tono, string> = {
  neutral: '',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  primary: 'text-primary',
}
const tonoVar: Record<Tono, string> = {
  neutral: 'var(--muted)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  primary: 'var(--primary)',
}

/** Icono sobre un fondo teñido con el color dado. */
export function IconBadge({ icon: Icono, color = 'var(--primary)', size = 'md', solid = false }: { icon: LucideIcon; color?: string; size?: 'sm' | 'md' | 'lg'; solid?: boolean }) {
  const dim = size === 'sm' ? 'h-8 w-8 rounded-[10px]' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl'
  const px = size === 'sm' ? 16 : size === 'lg' ? 22 : 19
  return (
    <span
      className={`${dim} shrink-0 grid place-items-center`}
      style={solid ? { background: color, color: '#fff' } : { background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      <Icono size={px} strokeWidth={2.1} />
    </span>
  )
}

export function KPI({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tono
  icon?: LucideIcon
}) {
  return (
    <div className="card p-3.5 md:p-4 min-w-0 flex flex-col">
      <div className="flex flex-col items-start sm:flex-row sm:items-center gap-2">
        {icon && <IconBadge icon={icon} color={tonoVar[tone === 'neutral' ? 'primary' : tone]} size="sm" />}
        <p className="text-[13px] text-muted leading-tight">{label}</p>
      </div>
      <p className={`num font-extrabold text-lg md:text-[22px] mt-2 ${tonoTexto[tone]} break-words leading-tight tracking-tight`}>{value}</p>
      {hint && <p className="text-xs text-muted mt-1 leading-snug">{hint}</p>}
    </div>
  )
}

/* ───────────────────────── Números y barras ───────────────────────── */

/** Número que se anima al cambiar de valor. */
export function AnimatedNumber({ value, format, desdeCero = false }: { value: number; format: (n: number) => string; desdeCero?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(desdeCero ? 0 : value)
  const reducir = useReducedMotion()
  const fmt = useRef(format)
  useEffect(() => {
    fmt.current = format
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducir || prev.current === value) {
      el.textContent = fmt.current(value)
      prev.current = value
      return
    }
    const ctl = animate(prev.current, value, {
      duration: 0.9,
      ease,
      onUpdate: (v) => (el.textContent = fmt.current(v)),
    })
    prev.current = value
    return () => ctl.stop()
  }, [value, reducir])
  return <span ref={ref}>{format(desdeCero && !reducir ? 0 : value)}</span>
}

export function tonoEstado(e: Estado): Tono {
  return e === 'Excedido' ? 'bad' : e === 'En riesgo' ? 'warn' : 'ok'
}

export function EstadoPill({ estado }: { estado: Estado }) {
  const cls = estado === 'Excedido' ? 'pill-bad' : estado === 'En riesgo' ? 'pill-warn' : 'pill-ok'
  const Icono = estado === 'Excedido' ? CircleAlert : estado === 'En riesgo' ? TriangleAlert : CircleCheck
  return (
    <span className={`pill ${cls}`}>
      <Icono size={12} strokeWidth={2.5} />
      {estado}
    </span>
  )
}

export function Barra({ pct, tone = 'primary', color, alto = 'h-2' }: { pct: number | null; tone?: Tono; color?: string; alto?: string }) {
  const v = Math.max(0, Math.min(1, pct ?? 0))
  return (
    <div className={`${alto} rounded-full bg-surface-3/70 overflow-hidden`}>
      <motion.div
        className="h-full rounded-full"
        initial={false}
        animate={{ width: `${v * 100}%` }}
        transition={{ duration: 0.6, ease }}
        style={{ background: color ?? tonoVar[tone] }}
      />
    </div>
  )
}

/* ───────────────────────── Formularios ───────────────────────── */

export function Field({ label, children, hint, className = '', grupo = false }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string; grupo?: boolean }) {
  const id = useId()
  // Con varios controles (botones, chips) se usa un grupo: un <label> se asociaría solo al primero.
  if (grupo) {
    return (
      <div role="group" aria-labelledby={id} className={`block min-w-0 ${className}`}>
        <span id={id} className="block text-[13px] font-semibold text-muted mb-1.5">
          {label}
        </span>
        {children}
        {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
      </div>
    )
  }
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[13px] font-semibold text-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

export interface OpcionSegmento<T extends string | number> {
  id: T
  label: ReactNode
  icon?: LucideIcon
}

/** Control segmentado con indicador que se desliza al opción activa. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
  full = false,
  size = 'md',
}: {
  options: OpcionSegmento<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  full?: boolean
  size?: 'sm' | 'md'
}) {
  const id = useId()
  return (
    <div role="tablist" className={`relative flex gap-1 p-1 rounded-[14px] bg-surface-3/70 overflow-x-auto no-scrollbar ${full ? 'w-full' : 'w-fit max-w-full'} ${className}`}>
      {options.map((o) => {
        const activo = o.id === value
        const Icono = o.icon
        return (
          <button
            key={String(o.id)}
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(o.id)}
            className={`relative ${full ? 'flex-1' : ''} ${size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-3.5 py-2 text-sm'} rounded-[10px] font-semibold whitespace-nowrap transition-colors ${
              activo ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {activo && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px] bg-surface shadow-[var(--shadow)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative inline-flex items-center justify-center gap-1.5">
              {Icono && <Icono size={15} strokeWidth={2.3} className={activo ? 'text-primary' : ''} />}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ───────────────────────── Hoja / diálogo ───────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  wide?: boolean
  footer?: ReactNode
}) {
  const movil = useEsMovil()
  const drag = useDragControls()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-[#0b0c1a]/50 backdrop-blur-[3px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className={`relative w-full ${wide ? 'md:max-w-3xl' : 'md:max-w-lg'} max-h-[94dvh] md:max-h-[88dvh] flex flex-col bg-surface border border-line rounded-t-[1.75rem] md:rounded-[1.5rem] shadow-[var(--shadow-lg)]`}
            initial={movil ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={movil ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={movil ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={movil ? { type: 'spring', stiffness: 380, damping: 38 } : { duration: 0.22, ease }}
            drag={movil ? 'y' : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <DragHeader movil={movil} title={title} onClose={onClose} drag={drag} />
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-5 pb-4 md:pb-5 pt-1">{children}</div>
            {footer && <div className="border-t border-line px-4 md:px-5 py-3 safe-bottom">{footer}</div>}
            {!footer && <div className="safe-bottom" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function DragHeader({ movil, title, onClose, drag }: { movil: boolean; title: ReactNode; onClose: () => void; drag: DragControls }) {
  // En móvil se arrastra la cabecera hacia abajo para cerrar la hoja.
  return (
    <div className={`shrink-0 ${movil ? 'touch-none cursor-grab' : ''}`} onPointerDown={(e) => movil && drag.start(e)}>
      {movil && <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-3" />}
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 pt-3 pb-3">
        <h2 className="font-extrabold text-lg tracking-tight">{title}</h2>
        <button className="btn btn-icon text-muted" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>
    </div>
  )
}

/* ───────────────────────── Selector de mes ───────────────────────── */

export function MonthPicker({ mes, onChange }: { mes: string; onChange: (m: string) => void }) {
  const esActual = mes === mesActual()
  const [dir, setDir] = useState(0)
  const ir = (n: number) => {
    setDir(n)
    onChange(mesMas(mes, n))
  }
  return (
    <div className="inline-flex items-center rounded-full bg-surface border border-line shadow-[var(--shadow)] p-1">
      <button className="btn btn-icon !min-h-8 !min-w-8 !rounded-full text-muted" onClick={() => ir(-1)} aria-label="Mes anterior">
        <ChevronLeft size={18} />
      </button>
      <button
        className="relative font-bold text-sm px-1 w-[8.5rem] h-8 overflow-hidden text-center"
        onClick={() => {
          setDir(mes < mesActual() ? 1 : -1)
          onChange(mesActual())
        }}
        title="Ir al mes actual"
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.span
            key={mes}
            custom={dir}
            className="absolute inset-0 grid place-items-center"
            initial={{ x: dir * 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -30, opacity: 0 }}
            transition={{ duration: 0.22, ease }}
          >
            {nombreMes(mes)}
          </motion.span>
        </AnimatePresence>
      </button>
      <button className="btn btn-icon !min-h-8 !min-w-8 !rounded-full text-muted" onClick={() => ir(1)} aria-label="Mes siguiente" disabled={esActual}>
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

/* ───────────────────────── Estados vacíos y tablas ───────────────────────── */

export function Empty({ icon: Icono, title, children, action }: { icon?: LucideIcon; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      {Icono && (
        <span className="h-14 w-14 rounded-2xl grid place-items-center bg-primary-soft text-primary mb-3">
          <Icono size={26} strokeWidth={1.9} />
        </span>
      )}
      {title && <p className="font-bold">{title}</p>}
      {children && <p className="text-sm text-muted mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Th({ children, right = false, className = '' }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <th className={`text-xs font-semibold text-muted py-2.5 px-3 ${right ? 'text-right' : 'text-left'} ${className}`}>{children}</th>
}

export function Td({ children, right = false, className = '' }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <td className={`py-2.5 px-3 text-sm ${right ? 'text-right num whitespace-nowrap' : ''} ${className}`}>{children}</td>
}

/** Fila etiqueta–valor para vistas de tarjeta en móvil. */
export function Dato({ k, v, cls = '' }: { k: ReactNode; v: ReactNode; cls?: string }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <span className="text-muted">{k}</span>
      <span className={`num font-semibold text-right ${cls}`}>{v}</span>
    </div>
  )
}

/* ───────────────────────── Avisos y confirmaciones ───────────────────────── */

const iconoToast: Record<TonoToast, LucideIcon> = { ok: CircleCheck, info: Info, warn: TriangleAlert, bad: CircleAlert }
const colorToast: Record<TonoToast, string> = { ok: 'var(--ok)', info: 'var(--primary)', warn: 'var(--warn)', bad: 'var(--bad)' }

export function Toaster() {
  const toasts = useFeedback((s) => s.toasts)
  const cerrar = useFeedback((s) => s.cerrarToast)
  return (
    <div className="fixed z-[60] inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 flex flex-col items-center md:items-end gap-2 px-3 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icono = iconoToast[t.tono]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto w-full max-w-sm flex items-start gap-3 rounded-2xl bg-ink text-bg px-4 py-3 shadow-[var(--shadow-lg)]"
              role="status"
            >
              <Icono size={20} className="shrink-0 mt-0.5" style={{ color: colorToast[t.tono] === 'var(--primary)' ? 'var(--primary-soft)' : colorToast[t.tono] }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug">{t.texto}</p>
                {t.detalle && <p className="text-xs opacity-75 mt-0.5 leading-snug">{t.detalle}</p>}
              </div>
              {t.accion && (
                <button
                  className="text-sm font-bold text-accent shrink-0"
                  onClick={() => {
                    t.accion!.onClick()
                    cerrar(t.id)
                  }}
                >
                  {t.accion.texto}
                </button>
              )}
              {!t.accion && (
                <button className="opacity-60 hover:opacity-100 shrink-0" onClick={() => cerrar(t.id)} aria-label="Cerrar aviso">
                  <X size={16} />
                </button>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export function ConfirmDialog() {
  const c = useFeedback((s) => s.confirmacion)
  return (
    <Modal open={Boolean(c)} onClose={() => c?.resolver(false)} title={c?.titulo ?? ''}>
      {c && (
        <div>
          {c.texto && <p className="text-sm text-muted">{c.texto}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
            <button className="btn btn-ghost" onClick={() => c.resolver(false)}>
              Cancelar
            </button>
            <button className={`btn ${c.peligro ? 'bg-bad text-white' : 'btn-primary'}`} onClick={() => c.resolver(true)} autoFocus>
              {c.aceptar ?? 'Aceptar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
