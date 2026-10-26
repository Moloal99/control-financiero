import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { Estado } from '../types'
import { mesActual, nombreMes } from '../lib/format'
import { mesMas } from '../lib/calc'

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  padding = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <section className={`card ${padding ? 'p-4 md:p-5' : ''} ${className}`}>
      {(title || action) && (
        <header className={`flex items-start justify-between gap-3 ${padding ? 'mb-3' : 'p-4 pb-0'}`}>
          <div>
            {title && <h2 className="font-semibold text-base leading-tight">{title}</h2>}
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action}
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

export function KPI({ label, value, hint, tone = 'neutral', small = false }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tono; small?: boolean }) {
  return (
    <div className="card p-3.5 md:p-4 min-w-0">
      <p className="text-xs md:text-sm text-muted leading-tight">{label}</p>
      <p className={`num font-bold ${small ? 'text-lg' : 'text-lg md:text-2xl'} mt-1 ${tonoTexto[tone]} break-words leading-tight`}>{value}</p>
      {hint && <p className="text-xs text-muted mt-1 leading-tight">{hint}</p>}
    </div>
  )
}

export function tonoEstado(e: Estado): Tono {
  return e === 'Excedido' ? 'bad' : e === 'En riesgo' ? 'warn' : 'ok'
}

export function EstadoPill({ estado }: { estado: Estado }) {
  const cls = estado === 'Excedido' ? 'pill-bad' : estado === 'En riesgo' ? 'pill-warn' : 'pill-ok'
  return <span className={`pill ${cls}`}>{estado}</span>
}

export function Barra({ pct, tone = 'primary' }: { pct: number | null; tone?: Tono }) {
  const v = Math.max(0, Math.min(1, pct ?? 0))
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : 'var(--primary)'
  return (
    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${v * 100}%`, background: color }} />
    </div>
  )
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'md:max-w-3xl' : 'md:max-w-lg'} max-h-[92dvh] md:max-h-[88dvh] overflow-y-auto bg-surface border border-line rounded-t-2xl md:rounded-2xl shadow-2xl safe-bottom`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-line bg-surface">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button className="btn btn-ghost !min-h-9 !px-2" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function MonthPicker({ mes, onChange }: { mes: string; onChange: (m: string) => void }) {
  const esActual = mes === mesActual()
  return (
    <div className="inline-flex items-center gap-1 card !rounded-full px-1 py-1">
      <button className="btn btn-ghost !border-0 !min-h-8 !px-2 !rounded-full" onClick={() => onChange(mesMas(mes, -1))} aria-label="Mes anterior">
        <ChevronLeft size={18} />
      </button>
      <button className="font-semibold text-sm px-1 min-w-28 text-center" onClick={() => onChange(mesActual())} title="Ir al mes actual">
        {nombreMes(mes)}
      </button>
      <button
        className="btn btn-ghost !border-0 !min-h-8 !px-2 !rounded-full disabled:opacity-40"
        onClick={() => onChange(mesMas(mes, 1))}
        aria-label="Mes siguiente"
        disabled={esActual}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted text-center py-6">{children}</p>
}

export function Th({ children, right = false }: { children: ReactNode; right?: boolean }) {
  return <th className={`text-xs font-semibold text-muted uppercase tracking-wide py-2 px-2 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}

export function Td({ children, right = false, className = '' }: { children: ReactNode; right?: boolean; className?: string }) {
  return <td className={`py-2 px-2 text-sm ${right ? 'text-right num' : ''} ${className}`}>{children}</td>
}

/** Resuelve un color expresado como var(--cN) a su valor computado (para SVG de gráficos). */
export function colorReal(c: string): string {
  const m = c.match(/^var\((--[\w-]+)\)$/)
  if (!m) return c
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
  return v || '#0f766e'
}
