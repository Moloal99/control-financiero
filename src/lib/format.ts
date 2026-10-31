import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const nf = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf0 = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 })

export function money(n: number, moneda = 'Bs'): string {
  const v = Number.isFinite(n) ? n : 0
  const sign = v < 0 ? '-' : ''
  return `${sign}${moneda} ${nf.format(Math.abs(v))}`
}

export function moneyShort(n: number, moneda = 'Bs'): string {
  const v = Number.isFinite(n) ? n : 0
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${moneda} ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${sign}${moneda} ${(abs / 1000).toFixed(1)}k`
  return `${sign}${moneda} ${nf0.format(abs)}`
}

export function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(digits)}%`
}

export function hoyISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function mesDe(fechaISO: string): string {
  return fechaISO.slice(0, 7)
}

export function mesActual(): string {
  return format(new Date(), 'yyyy-MM')
}

export function nombreMes(mes: string, corto = false): string {
  const d = parseISO(`${mes}-01`)
  const s = format(d, corto ? 'MMM yy' : 'MMMM yyyy', { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fechaCorta(fechaISO: string): string {
  return format(parseISO(fechaISO), 'd MMM', { locale: es })
}

export function fechaLarga(fechaISO: string): string {
  const s = format(parseISO(fechaISO), "EEEE d 'de' MMMM", { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function num(v: string | number): number {
  if (typeof v === 'number') return v
  const s = v.replace(/\s/g, '').replace(/[^\d,.-]/g, '')
  // "10.000" o "1.500.000" (punto de miles, sin decimales) en formato boliviano.
  if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, '')) || 0
  // Acepta "1.500,50" y "1500.50"
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(s.replace(/,/g, '')) || 0
}
