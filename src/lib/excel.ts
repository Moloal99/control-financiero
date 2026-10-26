import * as XLSX from 'xlsx'
import type { Datos, Gasto, Movimiento } from '../types'
import { num, uid } from './format'
import { COLORES } from './seed'

type Fila = Record<string, unknown>

function texto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function fechaISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = texto(v)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }
  return null
}

/** Busca la fila de encabezados (la primera con una celda exactamente "Fecha", "Categoría", "Cuenta" o "Fondo")
 *  y devuelve las filas siguientes hasta la primera fila vacía, omitiendo totales. */
function tabla(ws: XLSX.WorkSheet): Fila[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true })
  const h = rows.findIndex((r) => r.some((c) => typeof c === 'string' && /^(fecha|categor[ií]a|cuenta|fondo)$/i.test(c.trim())))
  if (h < 0) return []
  const headers = rows[h].map((c) => texto(c))
  const out: Fila[] = []
  for (const r of rows.slice(h + 1)) {
    if (!r.some((c) => c !== null && c !== '')) break
    const o: Fila = {}
    headers.forEach((k, i) => { if (k) o[k] = r[i] })
    const primero = texto(r[headers.findIndex((k) => k !== '')])
    if (!primero || /^total$/i.test(primero)) continue
    out.push(o)
  }
  return out
}

function col(f: Fila, ...nombres: string[]): unknown {
  for (const k of Object.keys(f)) {
    if (nombres.some((n) => k.toLowerCase().startsWith(n.toLowerCase()))) return f[k]
  }
  return undefined
}

export interface ResultadoImportacion {
  datos: Datos
  gastos: number
  movimientos: number
  categorias: number
  cuentas: number
  fondos: number
  avisos: string[]
}

/**
 * Importa el libro RegistroGastosMensual.xlsm (hojas Presupuesto, Cuentas, Distribución, Registro, Movimientos).
 * Combina con los datos actuales: crea categorías/cuentas/fondos que no existan y agrega gastos y movimientos.
 */
export function importarExcel(buffer: ArrayBuffer, actual: Datos): ResultadoImportacion {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const avisos: string[] = []
  const d: Datos = JSON.parse(JSON.stringify(actual)) as Datos
  const hoja = (n: string) => wb.Sheets[wb.SheetNames.find((s) => s.toLowerCase().startsWith(n.toLowerCase())) ?? '']

  const cat = (nombre: string) => {
    if (!nombre) return null
    let c = d.categorias.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
    if (!c) {
      c = { id: uid(), nombre, presupuesto: 0, color: COLORES[d.categorias.length % COLORES.length] }
      d.categorias.push(c)
    }
    return c
  }
  const cta = (nombre: string) => {
    if (!nombre) return null
    let c = d.cuentas.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
    if (!c) {
      c = { id: uid(), nombre, tipo: /efectivo/i.test(nombre) ? 'Efectivo' : 'Banco', saldoInicial: 0, fechaSaldo: '2000-01-01' }
      d.cuentas.push(c)
    }
    return c
  }
  const fon = (nombre: string) => {
    if (!nombre) return null
    let f = d.fondos.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
    if (!f) {
      f = { id: uid(), nombre, porcentaje: 0, cuentaId: null, enSaldoNeto: true }
      d.fondos.push(f)
    }
    return f
  }
  const met = (nombre: string) => {
    if (!nombre) return null
    let m = d.metodos.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
    if (!m) {
      m = { id: uid(), nombre }
      d.metodos.push(m)
    }
    return m
  }

  // Presupuesto y parámetros
  const wsP = hoja('Presupuesto')
  let nCat = 0
  if (wsP) {
    const ing = wsP['B3']?.v
    if (typeof ing === 'number' && ing > 0) d.ajustes.ingresoMensual = ing
    const inf = wsP['B4']?.v
    if (typeof inf === 'number') d.ajustes.inflacionMensual = inf
    for (const f of tabla(wsP)) {
      const nombre = texto(col(f, 'Categor'))
      const pres = col(f, 'Presupuesto')
      if (nombre) {
        const c = cat(nombre)!
        if (typeof pres === 'number') c.presupuesto = pres
        nCat++
      }
      const metodo = texto(col(f, 'Método', 'Metodo'))
      if (metodo) met(metodo)
    }
  }

  // Cuentas
  const wsC = hoja('Cuentas')
  let nCta = 0
  if (wsC) {
    for (const f of tabla(wsC)) {
      const nombre = texto(col(f, 'Cuenta'))
      if (!nombre || /^total$/i.test(nombre)) continue
      const c = cta(nombre)!
      const tipo = texto(col(f, 'Tipo'))
      if (/efectivo/i.test(tipo)) c.tipo = 'Efectivo'
      else if (/billetera/i.test(tipo)) c.tipo = 'Billetera'
      else if (tipo) c.tipo = 'Banco'
      const saldo = col(f, 'Saldo inicial')
      if (typeof saldo === 'number') c.saldoInicial = saldo
      const fecha = fechaISO(col(f, 'Fecha'))
      if (fecha) c.fechaSaldo = fecha
      nCta++
    }
  }

  // Distribución (fondos)
  const wsD = hoja('Distribuci')
  let nFon = 0
  if (wsD) {
    for (const f of tabla(wsD)) {
      const nombre = texto(col(f, 'Fondo'))
      const pctV = col(f, '% del ingreso')
      if (!nombre || typeof pctV !== 'number') continue
      const fo = fon(nombre)!
      fo.porcentaje = pctV
      fo.enSaldoNeto = /^s[ií]$/i.test(texto(col(f, 'Incluido')))
      const cuenta = cta(texto(col(f, 'Cuenta')))
      fo.cuentaId = cuenta?.id ?? null
      nFon++
    }
  }

  // Registro de gastos
  const wsR = hoja('Registro')
  let nG = 0
  if (wsR) {
    for (const f of tabla(wsR)) {
      const fecha = fechaISO(col(f, 'Fecha'))
      const montoV = col(f, 'Monto')
      const monto = typeof montoV === 'number' ? montoV : num(texto(montoV))
      if (!fecha || !(monto > 0)) continue
      const c = cat(texto(col(f, 'Categor')))
      if (!c) { avisos.push(`Gasto sin categoría omitido (${fecha})`); continue }
      const g: Gasto = {
        id: uid(),
        fecha,
        categoriaId: c.id,
        descripcion: texto(col(f, 'Descripci')),
        monto,
        metodoId: met(texto(col(f, 'Método', 'Metodo')))?.id ?? null,
        cuentaId: cta(texto(col(f, 'Cuenta')))?.id ?? null,
        fondoId: fon(texto(col(f, 'Fondo')))?.id ?? null,
      }
      const dup = d.gastos.some((x) => x.fecha === g.fecha && x.monto === g.monto && x.descripcion === g.descripcion && x.categoriaId === g.categoriaId)
      if (dup) continue
      d.gastos.push(g)
      nG++
    }
  }

  // Movimientos
  const wsM = hoja('Movimientos')
  let nM = 0
  if (wsM) {
    for (const f of tabla(wsM)) {
      const fecha = fechaISO(col(f, 'Fecha'))
      const montoV = col(f, 'Monto')
      const monto = typeof montoV === 'number' ? montoV : num(texto(montoV))
      if (!fecha || !(monto > 0)) continue
      const tipo = /transf/i.test(texto(col(f, 'Tipo'))) ? 'transferencia' : 'ingreso'
      const m: Movimiento = {
        id: uid(),
        fecha,
        tipo,
        descripcion: texto(col(f, 'Descripci')),
        cuentaOrigenId: tipo === 'transferencia' ? (cta(texto(col(f, 'Cuenta origen')))?.id ?? null) : null,
        cuentaDestinoId: cta(texto(col(f, 'Cuenta destino')))?.id ?? null,
        monto,
      }
      const dup = d.movimientos.some((x) => x.fecha === m.fecha && x.monto === m.monto && x.tipo === m.tipo && x.cuentaDestinoId === m.cuentaDestinoId)
      if (dup) continue
      d.movimientos.push(m)
      nM++
    }
  }

  if (!wsP && !wsR && !wsM) avisos.push('No se encontraron las hojas esperadas (Presupuesto, Registro, Movimientos).')

  return { datos: d, gastos: nG, movimientos: nM, categorias: nCat, cuentas: nCta, fondos: nFon, avisos }
}

/** Exporta todos los datos a un libro Excel con el mismo esquema de hojas. */
export function exportarExcel(d: Datos): Blob {
  const wb = XLSX.utils.book_new()
  const nombre = (arr: { id: string; nombre: string }[], id: string | null) => arr.find((x) => x.id === id)?.nombre ?? ''
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.gastos
        .slice()
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((g) => ({
          Fecha: g.fecha,
          Mes: g.fecha.slice(0, 7),
          Categoría: nombre(d.categorias, g.categoriaId),
          Descripción: g.descripcion,
          'Monto (Bs)': g.monto,
          'Método de pago': nombre(d.metodos, g.metodoId),
          Cuenta: nombre(d.cuentas, g.cuentaId),
          Fondo: nombre(d.fondos, g.fondoId),
        })),
    ),
    'Registro',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.movimientos
        .slice()
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((m) => ({
          Fecha: m.fecha,
          Mes: m.fecha.slice(0, 7),
          Tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Transferencia',
          Descripción: m.descripcion,
          'Cuenta origen': nombre(d.cuentas, m.cuentaOrigenId),
          'Cuenta destino': nombre(d.cuentas, m.cuentaDestinoId),
          'Monto (Bs)': m.monto,
        })),
    ),
    'Movimientos',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(d.categorias.map((c) => ({ Categoría: c.nombre, 'Presupuesto mensual (Bs)': c.presupuesto }))),
    'Presupuesto',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.cuentas.map((c) => ({ Cuenta: c.nombre, Tipo: c.tipo, 'Saldo inicial (Bs)': c.saldoInicial, 'Fecha del saldo': c.fechaSaldo })),
    ),
    'Cuentas',
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.fondos.map((f) => ({
        Fondo: f.nombre,
        '% del ingreso': f.porcentaje,
        'Incluido en saldo neto': f.enSaldoNeto ? 'Sí' : 'No',
        Cuenta: nombre(d.cuentas, f.cuentaId),
      })),
    ),
    'Distribución',
  )
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
