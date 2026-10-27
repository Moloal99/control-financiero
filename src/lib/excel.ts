/**
 * Importación y exportación de datos.
 * - Exportar: ExcelJS (permite formato: encabezados con color, filtros, anchos, formatos de número y fecha).
 * - Importar: SheetJS (lee .xlsx, .xlsm, .xls y .csv) y también respaldos .json.
 * Este módulo se carga bajo demanda para no pesar en el arranque de la app.
 */
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import type { Categoria, Cuenta, Datos, Fondo, Gasto, MetodoPago, Movimiento } from '../types'
import { num, uid } from './format'
import { COLORES } from './seed'
import { ICONOS, sugerirIcono } from './iconos'

/* ═════════════════════════ Utilidades ═════════════════════════ */

export function descargar(blob: Blob, nombre: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MARCA = 'FF3D35B5'
const MARCA_SUAVE = 'FFE8E6FB'
const FMT_MONTO = '#,##0.00'
const FMT_FECHA = 'dd/mm/yyyy'
const FMT_PCT = '0.0%'

const nombreDe = (arr: { id: string; nombre: string }[], id: string | null) => arr.find((x) => x.id === id)?.nombre ?? ''

/** Fecha ISO (yyyy-mm-dd) a Date en UTC, para que Excel guarde el día exacto sin desfase de zona horaria. */
function fechaExcel(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/* ═════════════════════════ Exportar ═════════════════════════ */

export interface OpcionesExport {
  /** Fechas ISO inclusivas; si faltan, se exporta todo. */
  desde?: string
  hasta?: string
  titulo?: string
  /** Solo las hojas Registro y Movimientos (sin configuración ni resumen). */
  soloMovimientos?: boolean
}

interface Columna {
  header: string
  key: string
  width: number
  fmt?: string
}

function hoja(wb: ExcelJS.Workbook, nombre: string, columnas: Columna[], filas: Record<string, unknown>[], opciones: { total?: string[]; color?: string } = {}) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: opciones.color ?? MARCA } },
  })
  ws.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }))
  for (const f of filas) ws.addRow(f)

  const head = ws.getRow(1)
  head.height = 24
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA } }
    cell.alignment = { vertical: 'middle' }
  })
  if (filas.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
  }

  // Fila de total con SUBTOTAL: respeta los filtros aplicados en Excel.
  if (opciones.total && filas.length > 0) {
    const ultima = filas.length + 1
    const fila = ws.addRow({})
    fila.getCell(1).value = 'Total'
    for (const key of opciones.total) {
      const idx = columnas.findIndex((c) => c.key === key) + 1
      const letra = ws.getColumn(idx).letter
      fila.getCell(idx).value = { formula: `SUBTOTAL(109,${letra}2:${letra}${ultima})` }
      fila.getCell(idx).numFmt = FMT_MONTO
    }
    fila.font = { bold: true }
    fila.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA_SUAVE } }
      cell.border = { top: { style: 'thin', color: { argb: MARCA } } }
    })
  }
  return ws
}

function filasGastos(d: Datos, gastos: Gasto[]) {
  return gastos
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((g) => ({
      fecha: fechaExcel(g.fecha),
      mes: g.fecha.slice(0, 7),
      categoria: nombreDe(d.categorias, g.categoriaId),
      descripcion: g.descripcion,
      monto: g.monto,
      metodo: nombreDe(d.metodos, g.metodoId),
      cuenta: nombreDe(d.cuentas, g.cuentaId),
      fondo: nombreDe(d.fondos, g.fondoId),
    }))
}

const COLS_GASTOS: Columna[] = [
  { header: 'Fecha', key: 'fecha', width: 13, fmt: FMT_FECHA },
  { header: 'Mes', key: 'mes', width: 10 },
  { header: 'Categoría', key: 'categoria', width: 24 },
  { header: 'Descripción', key: 'descripcion', width: 36 },
  { header: 'Monto (Bs)', key: 'monto', width: 14, fmt: FMT_MONTO },
  { header: 'Método de pago', key: 'metodo', width: 20 },
  { header: 'Cuenta', key: 'cuenta', width: 16 },
  { header: 'Fondo', key: 'fondo', width: 16 },
]

const COLS_MOVS: Columna[] = [
  { header: 'Fecha', key: 'fecha', width: 13, fmt: FMT_FECHA },
  { header: 'Mes', key: 'mes', width: 10 },
  { header: 'Tipo', key: 'tipo', width: 15 },
  { header: 'Descripción', key: 'descripcion', width: 32 },
  { header: 'Cuenta origen', key: 'origen', width: 16 },
  { header: 'Cuenta destino', key: 'destino', width: 16 },
  { header: 'Monto (Bs)', key: 'monto', width: 14, fmt: FMT_MONTO },
]

function filasMovs(d: Datos, movs: Movimiento[]) {
  return movs
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => ({
      fecha: fechaExcel(m.fecha),
      mes: m.fecha.slice(0, 7),
      tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Transferencia',
      descripcion: m.descripcion,
      origen: nombreDe(d.cuentas, m.cuentaOrigenId),
      destino: nombreDe(d.cuentas, m.cuentaDestinoId),
      monto: m.monto,
    }))
}

function hojasConfiguracion(wb: ExcelJS.Workbook, d: Datos) {
  hoja(
    wb,
    'Presupuesto',
    [
      { header: 'Categoría', key: 'nombre', width: 26 },
      { header: 'Presupuesto mensual (Bs)', key: 'presupuesto', width: 24, fmt: FMT_MONTO },
      { header: 'Icono', key: 'icono', width: 16 },
    ],
    d.categorias.map((c) => ({ nombre: c.nombre, presupuesto: c.presupuesto, icono: c.icono ?? sugerirIcono(c.nombre) })),
    { total: ['presupuesto'], color: 'FFE09400' },
  )
  hoja(
    wb,
    'Cuentas',
    [
      { header: 'Cuenta', key: 'nombre', width: 20 },
      { header: 'Tipo', key: 'tipo', width: 13 },
      { header: 'Saldo inicial (Bs)', key: 'saldo', width: 18, fmt: FMT_MONTO },
      { header: 'Fecha del saldo', key: 'fecha', width: 16, fmt: FMT_FECHA },
    ],
    d.cuentas.map((c) => ({ nombre: c.nombre, tipo: c.tipo, saldo: c.saldoInicial, fecha: fechaExcel(c.fechaSaldo) })),
    { color: 'FFE09400' },
  )
  hoja(
    wb,
    'Distribución',
    [
      { header: 'Fondo', key: 'nombre', width: 18 },
      { header: '% del ingreso', key: 'pct', width: 15, fmt: FMT_PCT },
      { header: 'Incluido en saldo neto', key: 'neto', width: 22 },
      { header: 'Cuenta', key: 'cuenta', width: 18 },
      { header: 'Icono', key: 'icono', width: 14 },
    ],
    d.fondos.map((f) => ({ nombre: f.nombre, pct: f.porcentaje, neto: f.enSaldoNeto ? 'Sí' : 'No', cuenta: nombreDe(d.cuentas, f.cuentaId), icono: f.icono ?? sugerirIcono(f.nombre) })),
    { color: 'FFE09400' },
  )
  hoja(wb, 'Métodos de pago', [{ header: 'Método de pago', key: 'nombre', width: 26 }], d.metodos.map((m) => ({ nombre: m.nombre })), { color: 'FFE09400' })
  hoja(
    wb,
    'Ajustes',
    [
      { header: 'Parámetro', key: 'k', width: 26 },
      { header: 'Valor', key: 'v', width: 16 },
    ],
    [
      { k: 'Moneda', v: d.ajustes.moneda },
      { k: 'Ingreso mensual', v: d.ajustes.ingresoMensual },
      { k: 'Inflación mensual', v: d.ajustes.inflacionMensual },
    ],
    { color: 'FFE09400' },
  )
  const wsA = wb.getWorksheet('Ajustes')!
  wsA.getCell('B3').numFmt = FMT_MONTO
  wsA.getCell('B4').numFmt = '0.00%'
}

function hojaResumen(wb: ExcelJS.Workbook, d: Datos, gastos: Gasto[], movs: Movimiento[], titulo: string, rango: string) {
  const ws = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: 'FF12805C' } }, views: [{ showGridLines: false }] })
  ws.columns = [{ width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }]
  ws.getCell('A1').value = titulo
  ws.getCell('A1').font = { bold: true, size: 18, color: { argb: MARCA } }
  ws.getCell('A2').value = rango
  ws.getCell('A2').font = { color: { argb: 'FF646A7E' } }

  const presupuesto = d.categorias.reduce((a, c) => a + c.presupuesto, 0)
  const meses = [...new Set([...gastos.map((g) => g.fecha.slice(0, 7)), ...movs.map((m) => m.fecha.slice(0, 7))])].sort()

  const enc = (fila: number, valores: string[]) => {
    const r = ws.getRow(fila)
    valores.forEach((v, i) => {
      const c = r.getCell(i + 1)
      c.value = v
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARCA } }
    })
  }

  enc(4, ['Mes', 'Ingreso', 'Gasto', 'Presupuesto', 'Ahorro', 'Tasa ahorro'])
  let fila = 5
  for (const mes of meses) {
    const ingreso = movs.filter((m) => m.tipo === 'ingreso' && m.fecha.startsWith(mes)).reduce((a, m) => a + m.monto, 0)
    const gasto = gastos.filter((g) => g.fecha.startsWith(mes)).reduce((a, g) => a + g.monto, 0)
    const r = ws.getRow(fila)
    const r2 = (n: number) => Math.round(n * 100) / 100
    r.values = [mes, r2(ingreso), r2(gasto), r2(presupuesto), r2(ingreso - gasto), ingreso > 0 ? Math.round(((ingreso - gasto) / ingreso) * 10000) / 10000 : null]
    ;[2, 3, 4, 5].forEach((i) => (r.getCell(i).numFmt = FMT_MONTO))
    r.getCell(6).numFmt = FMT_PCT
    if (gasto > presupuesto) r.getCell(3).font = { color: { argb: 'FFC8304A' }, bold: true }
    fila++
  }
  if (meses.length === 0) ws.getCell(`A${fila++}`).value = 'Sin registros en este rango.'

  fila += 1
  enc(fila, ['Categoría', 'Gasto total', '% del gasto', 'Promedio mensual'])
  fila++
  const total = gastos.reduce((a, g) => a + g.monto, 0)
  const porCat = d.categorias
    .map((c) => ({ c, t: gastos.filter((g) => g.categoriaId === c.id).reduce((a, g) => a + g.monto, 0) }))
    .sort((a, b) => b.t - a.t)
  for (const { c, t } of porCat) {
    const r = ws.getRow(fila++)
    r.values = [c.nombre, Math.round(t * 100) / 100, total > 0 ? Math.round((t / total) * 10000) / 10000 : 0, meses.length ? Math.round((t / meses.length) * 100) / 100 : 0]
    r.getCell(2).numFmt = FMT_MONTO
    r.getCell(3).numFmt = FMT_PCT
    r.getCell(4).numFmt = FMT_MONTO
  }
}

/** Exporta los datos a un libro Excel con formato. Las hojas siguen el esquema que la importación entiende. */
export async function exportarExcel(d: Datos, opciones: OpcionesExport = {}): Promise<Blob> {
  const { desde, hasta } = opciones
  const enRango = (f: string) => (!desde || f >= desde) && (!hasta || f <= hasta)
  const gastos = d.gastos.filter((g) => enRango(g.fecha))
  const movs = d.movimientos.filter((m) => enRango(m.fecha))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Control Financiero'
  wb.created = new Date()

  const rango = desde || hasta ? `Del ${desde ? fmtFecha(desde) : 'inicio'} al ${hasta ? fmtFecha(hasta) : 'hoy'}` : 'Todos los registros'
  if (!opciones.soloMovimientos) hojaResumen(wb, d, gastos, movs, opciones.titulo ?? 'Control Financiero', rango)
  hoja(wb, 'Registro', COLS_GASTOS, filasGastos(d, gastos), { total: ['monto'], color: 'FFC2185B' })
  hoja(wb, 'Movimientos', COLS_MOVS, filasMovs(d, movs), { color: 'FF12805C' })
  if (!opciones.soloMovimientos) hojasConfiguracion(wb, d)

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: XLSX_MIME })
}

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** CSV simple (separado por punto y coma, como lo espera Excel en español) con gastos y movimientos. */
export function exportarCSV(d: Datos, opciones: OpcionesExport = {}): Blob {
  const { desde, hasta } = opciones
  const enRango = (f: string) => (!desde || f >= desde) && (!hasta || f <= hasta)
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const numES = (n: number) => n.toFixed(2).replace('.', ',')
  const filas: string[] = [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto (Bs)', 'Método de pago', 'Cuenta', 'Cuenta destino', 'Fondo'].join(';')]
  const todos = [
    ...d.gastos.filter((g) => enRango(g.fecha)).map((g) => ({ f: g.fecha, r: [fmtFecha(g.fecha), 'Gasto', nombreDe(d.categorias, g.categoriaId), g.descripcion, numES(g.monto), nombreDe(d.metodos, g.metodoId), nombreDe(d.cuentas, g.cuentaId), '', nombreDe(d.fondos, g.fondoId)] })),
    ...d.movimientos.filter((m) => enRango(m.fecha)).map((m) => ({ f: m.fecha, r: [fmtFecha(m.fecha), m.tipo === 'ingreso' ? 'Ingreso' : 'Transferencia', '', m.descripcion, numES(m.monto), '', nombreDe(d.cuentas, m.cuentaOrigenId), nombreDe(d.cuentas, m.cuentaDestinoId), ''] })),
  ].sort((a, b) => a.f.localeCompare(b.f))
  for (const x of todos) filas.push(x.r.map(esc).join(';'))
  return new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/** Plantilla vacía con listas desplegables para cargar gastos y movimientos desde Excel. */
export async function plantillaExcel(d: Datos): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Control Financiero'

  const ins = wb.addWorksheet('Instrucciones', { properties: { tabColor: { argb: 'FF12805C' } }, views: [{ showGridLines: false }] })
  ins.getColumn(1).width = 4
  ins.getColumn(2).width = 100
  const lineas: [string, boolean?][] = [
    ['Plantilla para importar a Control Financiero', true],
    [''],
    ['1. Anota tus gastos en la hoja Registro: una fila por gasto. Fecha, Categoría y Monto son obligatorios.'],
    ['2. Anota ingresos y transferencias en la hoja Movimientos. En Tipo escribe Ingreso o Transferencia.'],
    ['3. Las columnas Categoría, Cuenta, Fondo y Método tienen listas desplegables con lo que ya tienes en la app.'],
    ['    Si escribes un nombre nuevo, la app lo crea al importar (por ejemplo, una categoría nueva).'],
    ['4. Puedes editar las hojas Presupuesto, Cuentas, Distribución y Métodos de pago para cambiar tu configuración.'],
    ['5. Guarda el archivo y en la app ve a Importar y exportar, arrastra el archivo y revisa la vista previa antes de confirmar.'],
    [''],
    ['Los registros que ya existen (misma fecha, monto, descripción y categoría) no se duplican.'],
    ['Formato de fecha: dd/mm/aaaa o celdas de fecha de Excel. Montos con coma o punto decimal.'],
  ]
  lineas.forEach(([t, titulo], i) => {
    const c = ins.getCell(i + 2, 2)
    c.value = t
    c.font = titulo ? { bold: true, size: 16, color: { argb: MARCA } } : { size: 11 }
  })

  const wsR = hoja(wb, 'Registro', COLS_GASTOS, [], { color: 'FFC2185B' })
  hoja(wb, 'Movimientos', COLS_MOVS, [], { color: 'FF12805C' })
  hojasConfiguracion(wb, d)

  // Listas desplegables y fórmula de mes en las primeras 1000 filas.
  const lista = (hojaNombre: string, n: number) => [`'${hojaNombre}'!$A$2:$A$${Math.max(2, n + 1)}`]
  const wsM = wb.getWorksheet('Movimientos')!
  for (let r = 2; r <= 1001; r++) {
    wsR.getCell(`A${r}`).numFmt = FMT_FECHA
    wsR.getCell(`B${r}`).value = { formula: `IF(A${r}="","",TEXT(A${r},"yyyy-mm"))` }
    wsR.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Presupuesto', d.categorias.length) }
    wsR.getCell(`E${r}`).numFmt = FMT_MONTO
    wsR.getCell(`F${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Métodos de pago', d.metodos.length) }
    wsR.getCell(`G${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Cuentas', d.cuentas.length) }
    wsR.getCell(`H${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Distribución', d.fondos.length) }
    wsM.getCell(`A${r}`).numFmt = FMT_FECHA
    wsM.getCell(`B${r}`).value = { formula: `IF(A${r}="","",TEXT(A${r},"yyyy-mm"))` }
    wsM.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Ingreso,Transferencia"'] }
    wsM.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Cuentas', d.cuentas.length) }
    wsM.getCell(`F${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Cuentas', d.cuentas.length) }
    wsM.getCell(`G${r}`).numFmt = FMT_MONTO
  }
  wsR.autoFilter = { from: 'A1', to: 'H1' }
  wsM.autoFilter = { from: 'A1', to: 'G1' }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: XLSX_MIME })
}

/* ═════════════════════════ Importar ═════════════════════════ */

type Fila = Record<string, unknown>

function texto(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

function fechaISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number' && v > 0) {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = texto(v)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }
  return null
}

function monto(v: unknown): number {
  return typeof v === 'number' ? v : num(texto(v))
}

const RE_ENCABEZADO = /^(fecha|categor[ií]a|cuenta|fondo|m[eé]todo( de pago)?)$/i

/** Busca la fila de encabezados y devuelve las filas siguientes hasta la primera vacía, sin la fila Total. */
function tabla(ws: XLSX.WorkSheet): Fila[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true })
  const h = rows.findIndex((r) => r.some((c) => typeof c === 'string' && RE_ENCABEZADO.test(c.trim())))
  if (h < 0) return []
  const headers = rows[h].map((c) => texto(c))
  const out: Fila[] = []
  for (const r of rows.slice(h + 1)) {
    if (!r.some((c) => c !== null && c !== '')) break
    const o: Fila = {}
    headers.forEach((k, i) => {
      if (k) o[k] = r[i]
    })
    const primero = texto(r[headers.findIndex((k) => k !== '')])
    if (/^total$/i.test(primero)) continue
    out.push(o)
  }
  return out
}

function encabezados(ws: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true })
  const h = rows.find((r) => r.some((c) => typeof c === 'string' && RE_ENCABEZADO.test(c.trim())))
  return (h ?? []).map((c) => texto(c).toLowerCase())
}

function col(f: Fila, ...nombres: string[]): unknown {
  for (const k of Object.keys(f)) {
    if (nombres.some((n) => k.toLowerCase().startsWith(n.toLowerCase()))) return f[k]
  }
  return undefined
}

export type ModoImport = 'combinar' | 'reemplazar'

export interface Muestra {
  fecha: string
  tipo: 'Gasto' | 'Ingreso' | 'Transferencia'
  descripcion: string
  detalle: string
  monto: number
}

export interface ResultadoImportacion {
  datos: Datos
  archivo: string
  formato: 'Excel' | 'CSV' | 'Respaldo JSON'
  gastos: number
  movimientos: number
  duplicados: number
  omitidos: number
  categoriasNuevas: string[]
  cuentasNuevas: string[]
  fondosNuevos: string[]
  metodosNuevos: string[]
  configActualizada: string[]
  avisos: string[]
  muestra: Muestra[]
  desde: string | null
  hasta: string | null
}

/** Mantiene el estado de una importación: busca o crea entidades por nombre y evita duplicados. */
function crearImportador(base: Datos, r: ResultadoImportacion) {
  const d = r.datos
  const porNombre = <T extends { nombre: string }>(arr: T[], nombre: string) => arr.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
  const yaEstaba = {
    cat: new Set(base.categorias.map((c) => c.nombre.toLowerCase())),
    cta: new Set(base.cuentas.map((c) => c.nombre.toLowerCase())),
    fon: new Set(base.fondos.map((c) => c.nombre.toLowerCase())),
    met: new Set(base.metodos.map((c) => c.nombre.toLowerCase())),
  }
  const nueva = (set: Set<string>, lista: string[], nombre: string) => {
    if (!set.has(nombre.toLowerCase()) && !lista.some((x) => x.toLowerCase() === nombre.toLowerCase())) lista.push(nombre)
  }

  const cat = (nombre: string): Categoria | null => {
    if (!nombre) return null
    let c = porNombre(d.categorias, nombre)
    if (!c) {
      c = { id: uid(), nombre, presupuesto: 0, color: COLORES[d.categorias.length % COLORES.length], icono: sugerirIcono(nombre) }
      d.categorias.push(c)
      nueva(yaEstaba.cat, r.categoriasNuevas, nombre)
    }
    return c
  }
  const cta = (nombre: string): Cuenta | null => {
    if (!nombre) return null
    let c = porNombre(d.cuentas, nombre)
    if (!c) {
      c = { id: uid(), nombre, tipo: /efectivo/i.test(nombre) ? 'Efectivo' : /billetera|tigo|wallet/i.test(nombre) ? 'Billetera' : 'Banco', saldoInicial: 0, fechaSaldo: '2000-01-01' }
      d.cuentas.push(c)
      nueva(yaEstaba.cta, r.cuentasNuevas, nombre)
    }
    return c
  }
  const fon = (nombre: string): Fondo | null => {
    if (!nombre) return null
    let f = porNombre(d.fondos, nombre)
    if (!f) {
      f = { id: uid(), nombre, porcentaje: 0, cuentaId: null, enSaldoNeto: true, icono: sugerirIcono(nombre) }
      d.fondos.push(f)
      nueva(yaEstaba.fon, r.fondosNuevos, nombre)
    }
    return f
  }
  const met = (nombre: string): MetodoPago | null => {
    if (!nombre) return null
    let m = porNombre(d.metodos, nombre)
    if (!m) {
      m = { id: uid(), nombre }
      d.metodos.push(m)
      nueva(yaEstaba.met, r.metodosNuevos, nombre)
    }
    return m
  }

  const rango = (fecha: string) => {
    if (!r.desde || fecha < r.desde) r.desde = fecha
    if (!r.hasta || fecha > r.hasta) r.hasta = fecha
  }

  const agregarGasto = (g: Omit<Gasto, 'id'>) => {
    const dup = d.gastos.some((x) => x.fecha === g.fecha && Math.abs(x.monto - g.monto) < 0.005 && x.descripcion === g.descripcion && x.categoriaId === g.categoriaId)
    if (dup) {
      r.duplicados++
      return
    }
    d.gastos.push({ ...g, id: uid() })
    r.gastos++
    rango(g.fecha)
    if (r.muestra.length < 6) r.muestra.push({ fecha: g.fecha, tipo: 'Gasto', descripcion: g.descripcion, detalle: nombreDe(d.categorias, g.categoriaId), monto: g.monto })
  }

  const agregarMov = (m: Omit<Movimiento, 'id'>) => {
    const dup = d.movimientos.some((x) => x.fecha === m.fecha && Math.abs(x.monto - m.monto) < 0.005 && x.tipo === m.tipo && x.cuentaDestinoId === m.cuentaDestinoId && x.descripcion === m.descripcion)
    if (dup) {
      r.duplicados++
      return
    }
    d.movimientos.push({ ...m, id: uid() })
    r.movimientos++
    rango(m.fecha)
    if (r.muestra.length < 6)
      r.muestra.push({
        fecha: m.fecha,
        tipo: m.tipo === 'ingreso' ? 'Ingreso' : 'Transferencia',
        descripcion: m.descripcion,
        detalle: m.tipo === 'ingreso' ? nombreDe(d.cuentas, m.cuentaDestinoId) : `${nombreDe(d.cuentas, m.cuentaOrigenId)} a ${nombreDe(d.cuentas, m.cuentaDestinoId)}`,
        monto: m.monto,
      })
  }

  return { d, cat, cta, fon, met, agregarGasto, agregarMov }
}

function datosVacios(actual: Datos): Datos {
  return { categorias: [], metodos: [], cuentas: [], fondos: [], gastos: [], movimientos: [], ajustes: { ...actual.ajustes } }
}

function resultadoBase(datos: Datos, archivo: string, formato: ResultadoImportacion['formato']): ResultadoImportacion {
  return {
    datos,
    archivo,
    formato,
    gastos: 0,
    movimientos: 0,
    duplicados: 0,
    omitidos: 0,
    categoriasNuevas: [],
    cuentasNuevas: [],
    fondosNuevos: [],
    metodosNuevos: [],
    configActualizada: [],
    avisos: [],
    muestra: [],
    desde: null,
    hasta: null,
  }
}

/** Lee el archivo y calcula el resultado sin aplicarlo: la app muestra una vista previa antes de guardar. */
export async function analizarArchivo(file: File, actual: Datos, modo: ModoImport): Promise<ResultadoImportacion> {
  const nombre = file.name
  const base: Datos = modo === 'reemplazar' ? datosVacios(actual) : (JSON.parse(JSON.stringify(actual)) as Datos)

  if (/\.json$/i.test(nombre) || file.type === 'application/json') {
    return importarJSON(JSON.parse(await file.text()), base, actual, modo, nombre)
  }

  const esCSV = /\.csv$/i.test(nombre) || file.type === 'text/csv'
  let wb: XLSX.WorkBook
  if (esCSV) {
    // raw: true deja fechas y montos como texto para interpretarlos en formato boliviano (dd/mm/aaaa, 1.500,50).
    const t = (await file.text()).replace(/^\uFEFF/, '')
    wb = XLSX.read(t, { type: 'string', raw: true, FS: detectarSeparador(t) })
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  }
  return importarLibro(wb, base, nombre, esCSV ? 'CSV' : 'Excel')
}

function detectarSeparador(t: string): string {
  const linea = t.split(/\r?\n/)[0] ?? ''
  return (linea.match(/;/g)?.length ?? 0) >= (linea.match(/,/g)?.length ?? 0) ? ';' : ','
}

function importarLibro(wb: XLSX.WorkBook, base: Datos, archivo: string, formato: 'Excel' | 'CSV'): ResultadoImportacion {
  const r = resultadoBase(base, archivo, formato)
  const imp = crearImportador(base, r)
  const { d } = imp
  const buscar = (n: string) => {
    const k = wb.SheetNames.find((s) => s.toLowerCase().startsWith(n.toLowerCase()))
    return k ? wb.Sheets[k] : undefined
  }

  // Ajustes (hoja propia de la exportación)
  const wsAj = buscar('Ajustes')
  if (wsAj) {
    for (const fila of XLSX.utils.sheet_to_json<unknown[]>(wsAj, { header: 1, defval: null, raw: true })) {
      const k = texto(fila[0])
      const v = fila[1]
      if (/^ingreso/i.test(k) && typeof v === 'number') {
        d.ajustes.ingresoMensual = v
        r.configActualizada.push('ingreso mensual')
      } else if (/^inflaci/i.test(k) && typeof v === 'number') {
        d.ajustes.inflacionMensual = v
        r.configActualizada.push('inflación')
      } else if (/^moneda/i.test(k) && texto(v)) d.ajustes.moneda = texto(v)
    }
  }

  // Presupuesto. En el libro original, B3 = ingreso y B4 = inflación (solo si las etiquetas lo confirman).
  const wsP = buscar('Presupuesto')
  if (wsP) {
    if (/ingreso/i.test(texto(wsP['A3']?.v)) && typeof wsP['B3']?.v === 'number' && wsP['B3'].v > 0) {
      d.ajustes.ingresoMensual = wsP['B3'].v
      r.configActualizada.push('ingreso mensual')
    }
    if (/inflaci/i.test(texto(wsP['A4']?.v)) && typeof wsP['B4']?.v === 'number') d.ajustes.inflacionMensual = wsP['B4'].v
    let n = 0
    for (const f of tabla(wsP)) {
      const nombre = texto(col(f, 'Categor'))
      if (nombre) {
        const c = imp.cat(nombre)!
        const pres = col(f, 'Presupuesto')
        if (pres !== undefined && pres !== null && pres !== '') c.presupuesto = monto(pres)
        const ic = texto(col(f, 'Icono'))
        if (ic && ICONOS[ic]) c.icono = ic
        n++
      }
      const metodo = texto(col(f, 'Método', 'Metodo'))
      if (metodo) imp.met(metodo)
    }
    if (n) r.configActualizada.push(`${n} presupuestos`)
  }

  const wsMet = buscar('Métodos') ?? buscar('Metodos')
  if (wsMet) for (const f of tabla(wsMet)) imp.met(texto(col(f, 'Método', 'Metodo')))

  // Cuentas
  const wsC = buscar('Cuentas')
  if (wsC) {
    for (const f of tabla(wsC)) {
      const nombre = texto(col(f, 'Cuenta'))
      if (!nombre) continue
      const c = imp.cta(nombre)!
      const tipo = texto(col(f, 'Tipo'))
      if (/efectivo/i.test(tipo)) c.tipo = 'Efectivo'
      else if (/billetera/i.test(tipo)) c.tipo = 'Billetera'
      else if (/otro/i.test(tipo)) c.tipo = 'Otro'
      else if (tipo) c.tipo = 'Banco'
      const saldo = col(f, 'Saldo inicial')
      if (saldo !== undefined && saldo !== null && saldo !== '') c.saldoInicial = monto(saldo)
      const fecha = fechaISO(col(f, 'Fecha'))
      if (fecha) c.fechaSaldo = fecha
    }
  }

  // Distribución (fondos)
  const wsD = buscar('Distribuci')
  if (wsD) {
    for (const f of tabla(wsD)) {
      const nombre = texto(col(f, 'Fondo'))
      const pctV = col(f, '% del ingreso', '%')
      if (!nombre) continue
      const fo = imp.fon(nombre)!
      if (typeof pctV === 'number') fo.porcentaje = pctV > 1 ? pctV / 100 : pctV
      const incl = texto(col(f, 'Incluido'))
      if (incl) fo.enSaldoNeto = /^s[ií]/i.test(incl)
      const cuenta = imp.cta(texto(col(f, 'Cuenta')))
      if (cuenta) fo.cuentaId = cuenta.id
      const ic = texto(col(f, 'Icono'))
      if (ic && ICONOS[ic]) fo.icono = ic
    }
  }

  // Gastos y movimientos: por nombre de hoja o, si no existe, detectando las columnas (CSV u hojas sueltas).
  const hojasGastos: XLSX.WorkSheet[] = []
  const hojasMovs: XLSX.WorkSheet[] = []
  const wsR = buscar('Registro')
  const wsM = buscar('Movimientos')
  if (wsR) hojasGastos.push(wsR)
  if (wsM) hojasMovs.push(wsM)
  if (!wsR && !wsM) {
    for (const n of wb.SheetNames) {
      const ws = wb.Sheets[n]
      const h = encabezados(ws)
      const tiene = (re: RegExp) => h.some((x) => re.test(x))
      if (tiene(/^fecha/) && tiene(/^monto|^importe/)) {
        if (tiene(/^tipo/)) hojasMovs.push(ws) // CSV combinado: se separa por tipo abajo
        else if (tiene(/^categor/)) hojasGastos.push(ws)
      }
    }
  }

  for (const ws of hojasGastos) {
    for (const f of tabla(ws)) leerGasto(f)
  }
  for (const ws of hojasMovs) {
    for (const f of tabla(ws)) {
      const tipo = texto(col(f, 'Tipo'))
      if (/gasto/i.test(tipo)) leerGasto(f)
      else leerMov(f)
    }
  }

  function leerGasto(f: Fila) {
    const fecha = fechaISO(col(f, 'Fecha'))
    const m = Math.abs(monto(col(f, 'Monto', 'Importe')))
    if (!fecha || !(m > 0)) {
      r.omitidos++
      return
    }
    const c = imp.cat(texto(col(f, 'Categor')))
    if (!c) {
      r.omitidos++
      return
    }
    imp.agregarGasto({
      fecha,
      categoriaId: c.id,
      descripcion: texto(col(f, 'Descripci', 'Detalle', 'Concepto')),
      monto: Math.round(m * 100) / 100,
      metodoId: imp.met(texto(col(f, 'Método', 'Metodo')))?.id ?? null,
      cuentaId: imp.cta(texto(col(f, 'Cuenta')))?.id ?? null,
      fondoId: imp.fon(texto(col(f, 'Fondo')))?.id ?? null,
    })
  }

  function leerMov(f: Fila) {
    const fecha = fechaISO(col(f, 'Fecha'))
    const m = Math.abs(monto(col(f, 'Monto', 'Importe')))
    if (!fecha || !(m > 0)) {
      r.omitidos++
      return
    }
    const tipo = /transf/i.test(texto(col(f, 'Tipo'))) ? 'transferencia' : 'ingreso'
    const origenNombre = texto(col(f, 'Cuenta origen')) || (tipo === 'transferencia' ? texto(col(f, 'Cuenta')) : '')
    const destinoNombre = texto(col(f, 'Cuenta destino')) || (tipo === 'ingreso' ? texto(col(f, 'Cuenta')) : '')
    imp.agregarMov({
      fecha,
      tipo,
      descripcion: texto(col(f, 'Descripci', 'Detalle', 'Concepto')),
      cuentaOrigenId: tipo === 'transferencia' ? (imp.cta(origenNombre)?.id ?? null) : null,
      cuentaDestinoId: imp.cta(destinoNombre)?.id ?? null,
      monto: Math.round(m * 100) / 100,
    })
  }

  if (!wsP && !wsC && !wsD && hojasGastos.length === 0 && hojasMovs.length === 0) {
    r.avisos.push('No encontré hojas que pueda leer. Usa la plantilla o un archivo exportado desde la app.')
  }
  if (r.omitidos) r.avisos.push(`${r.omitidos} filas sin fecha, monto o categoría válidos se omitieron.`)
  const totalPct = d.fondos.reduce((a, f) => a + f.porcentaje, 0)
  if (d.fondos.length && Math.abs(totalPct - 1) > 0.001) r.avisos.push(`La distribución de fondos suma ${(totalPct * 100).toFixed(1)}%; ajústala en Ajustes para que sume 100%.`)
  return r
}

function importarJSON(json: unknown, base: Datos, actual: Datos, modo: ModoImport, archivo: string): ResultadoImportacion {
  const x = json as Partial<Datos>
  if (!x || !Array.isArray(x.categorias) || !Array.isArray(x.gastos)) throw new Error('El archivo no es un respaldo de Control Financiero.')
  const entrante: Datos = {
    categorias: x.categorias ?? [],
    metodos: x.metodos ?? [],
    cuentas: x.cuentas ?? [],
    fondos: x.fondos ?? [],
    gastos: x.gastos ?? [],
    movimientos: x.movimientos ?? [],
    ajustes: { ...actual.ajustes, ...(x.ajustes ?? {}) },
  }

  if (modo === 'reemplazar') {
    const r = resultadoBase({ ...entrante, ajustes: { ...entrante.ajustes, tema: actual.ajustes.tema } }, archivo, 'Respaldo JSON')
    r.gastos = entrante.gastos.length
    r.movimientos = entrante.movimientos.length
    r.categoriasNuevas = entrante.categorias.map((c) => c.nombre)
    r.cuentasNuevas = entrante.cuentas.map((c) => c.nombre)
    r.fondosNuevos = entrante.fondos.map((c) => c.nombre)
    const fechas = [...entrante.gastos.map((g) => g.fecha), ...entrante.movimientos.map((m) => m.fecha)].sort()
    r.desde = fechas[0] ?? null
    r.hasta = fechas.at(-1) ?? null
    r.muestra = entrante.gastos.slice(-6).map((g) => ({ fecha: g.fecha, tipo: 'Gasto', descripcion: g.descripcion, detalle: nombreDe(entrante.categorias, g.categoriaId), monto: g.monto }))
    return r
  }

  // Combinar: se emparejan categorías, cuentas, fondos y métodos por nombre.
  const r = resultadoBase(base, archivo, 'Respaldo JSON')
  const imp = crearImportador(base, r)
  for (const c of entrante.categorias) {
    const n = imp.cat(c.nombre)
    if (n && r.categoriasNuevas.includes(c.nombre)) Object.assign(n, { presupuesto: c.presupuesto, icono: c.icono ?? n.icono })
  }
  for (const c of entrante.cuentas) {
    const n = imp.cta(c.nombre)
    if (n && r.cuentasNuevas.includes(c.nombre)) Object.assign(n, { tipo: c.tipo, saldoInicial: c.saldoInicial, fechaSaldo: c.fechaSaldo })
  }
  for (const m of entrante.metodos) imp.met(m.nombre)
  for (const f of entrante.fondos) imp.fon(f.nombre)
  const n = (arr: { id: string; nombre: string }[], id: string | null) => nombreDe(arr, id)
  for (const g of entrante.gastos) {
    const c = imp.cat(n(entrante.categorias, g.categoriaId) || 'Sin categoría')!
    imp.agregarGasto({
      fecha: g.fecha,
      categoriaId: c.id,
      descripcion: g.descripcion,
      monto: g.monto,
      metodoId: imp.met(n(entrante.metodos, g.metodoId))?.id ?? null,
      cuentaId: imp.cta(n(entrante.cuentas, g.cuentaId))?.id ?? null,
      fondoId: imp.fon(n(entrante.fondos, g.fondoId))?.id ?? null,
    })
  }
  for (const m of entrante.movimientos) {
    imp.agregarMov({
      fecha: m.fecha,
      tipo: m.tipo,
      descripcion: m.descripcion,
      cuentaOrigenId: imp.cta(n(entrante.cuentas, m.cuentaOrigenId))?.id ?? null,
      cuentaDestinoId: imp.cta(n(entrante.cuentas, m.cuentaDestinoId))?.id ?? null,
      monto: m.monto,
    })
  }
  return r
}
