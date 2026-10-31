/**
 * Importación y exportación de datos.
 * - Exportar: ExcelJS (permite formato: encabezados con color, filtros, anchos, formatos de número y fecha).
 * - Importar: SheetJS (lee .xlsx, .xlsm, .xls y .csv) y también respaldos .json.
 * Este módulo se carga bajo demanda para no pesar en el arranque de la app.
 */
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import type { Categoria, Cuenta, Datos, Escenario, Fondo, Gasto, MetodoPago, Movimiento, Recurrente } from '../types'
import { hoyISO, mesActual, num, uid } from './format'
import { COLORES, fondoNuevo } from './seed'
import { convertirAhorroEnAportes, migrar, repartoActual, tipoFondoPorNombre } from './migrar'
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
      fijo: nombreDe(d.recurrentes, g.recurrenteId ?? null),
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
  { header: 'Fijo', key: 'fijo', width: 18 },
]

const COLS_MOVS: Columna[] = [
  { header: 'Fecha', key: 'fecha', width: 13, fmt: FMT_FECHA },
  { header: 'Mes', key: 'mes', width: 10 },
  { header: 'Tipo', key: 'tipo', width: 15 },
  { header: 'Descripción', key: 'descripcion', width: 32 },
  { header: 'Cuenta origen', key: 'origen', width: 16 },
  { header: 'Cuenta destino', key: 'destino', width: 16 },
  { header: 'Fondo origen', key: 'fondoO', width: 16 },
  { header: 'Fondo destino', key: 'fondoD', width: 16 },
  { header: 'Repartir', key: 'repartir', width: 10 },
  { header: 'Monto (Bs)', key: 'monto', width: 14, fmt: FMT_MONTO },
  { header: 'Reparto', key: 'reparto', width: 40 },
  { header: 'Fijo', key: 'fijo', width: 18 },
]

/** "Gastos 25%; Ahorro 45%": los porcentajes con que se repartió cada ingreso. */
function repartoTexto(d: Datos, m: Movimiento): string {
  if (m.tipo !== 'ingreso' || m.distribuir === false || !m.reparto) return ''
  return Object.entries(m.reparto)
    .map(([id, p]) => `${nombreDe(d.fondos, id)} ${Math.round(p * 10000) / 100}%`)
    .join('; ')
}

const TIPO_MOV: Record<Movimiento['tipo'], string> = { ingreso: 'Ingreso', transferencia: 'Transferencia', ajuste: 'Ajuste' }

function filasMovs(d: Datos, movs: Movimiento[]) {
  return movs
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => ({
      fecha: fechaExcel(m.fecha),
      mes: m.fecha.slice(0, 7),
      tipo: TIPO_MOV[m.tipo],
      descripcion: m.descripcion,
      origen: nombreDe(d.cuentas, m.cuentaOrigenId),
      destino: nombreDe(d.cuentas, m.cuentaDestinoId),
      fondoO: m.tipo === 'transferencia' ? nombreDe(d.fondos, m.fondoOrigenId ?? null) : '',
      fondoD: m.tipo === 'ingreso' && m.distribuir !== false ? '' : nombreDe(d.fondos, m.fondoDestinoId ?? null),
      repartir: m.tipo === 'ingreso' ? (m.distribuir !== false ? 'Sí' : 'No') : '',
      monto: m.monto,
      reparto: repartoTexto(d, m),
      fijo: nombreDe(d.recurrentes, m.recurrenteId ?? null),
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
      { header: 'Tipo de fondo', key: 'tipo', width: 14 },
      { header: '% del ingreso', key: 'pct', width: 15, fmt: FMT_PCT },
      { header: 'Incluido en saldo neto', key: 'neto', width: 22 },
      { header: 'Cuenta', key: 'cuenta', width: 18 },
      { header: 'Saldo inicial (Bs)', key: 'saldo', width: 18, fmt: FMT_MONTO },
      { header: 'Fecha del saldo', key: 'fechaSaldo', width: 15, fmt: FMT_FECHA },
      { header: 'Aporte mensual (Bs)', key: 'aporte', width: 19, fmt: FMT_MONTO },
      { header: 'Meta', key: 'metaTipo', width: 12 },
      { header: 'Meta objetivo (Bs)', key: 'meta', width: 18, fmt: FMT_MONTO },
      { header: 'Meta meses de gasto', key: 'metaMeses', width: 19 },
      { header: 'Meta fecha', key: 'metaFecha', width: 13, fmt: FMT_FECHA },
      { header: 'Icono', key: 'icono', width: 14 },
      { header: 'Archivado', key: 'archivado', width: 11 },
      { header: 'Meta creada', key: 'metaCreada', width: 13, fmt: FMT_FECHA },
    ],
    d.fondos.map((f) => ({
      nombre: f.nombre,
      tipo: f.tipo === 'ahorro' ? 'Ahorro' : 'Para gastar',
      pct: f.porcentaje,
      neto: f.enSaldoNeto ? 'Sí' : 'No',
      cuenta: nombreDe(d.cuentas, f.cuentaId),
      saldo: f.saldoInicial,
      fechaSaldo: f.fechaSaldo > '1900' ? fechaExcel(f.fechaSaldo) : null,
      aporte: f.aporteMensual,
      metaTipo: f.meta ? (f.meta.tipo === 'emergencia' ? 'Emergencia' : 'Monto') : '',
      meta: f.meta?.tipo === 'monto' ? f.meta.objetivo : null,
      metaMeses: f.meta?.tipo === 'emergencia' ? (f.meta.meses ?? 3) : null,
      metaFecha: f.meta?.fecha ? fechaExcel(f.meta.fecha) : null,
      icono: f.icono ?? sugerirIcono(f.nombre),
      archivado: f.archivado ? 'Sí' : '',
      metaCreada: f.meta?.creada ? fechaExcel(f.meta.creada) : null,
    })),
    { color: 'FFE09400' },
  )
  hoja(
    wb,
    'Recurrentes',
    [
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Monto (Bs)', key: 'monto', width: 14, fmt: FMT_MONTO },
      { header: 'Día', key: 'dia', width: 7 },
      { header: 'Frecuencia', key: 'frecuencia', width: 12 },
      { header: 'Mes (anual)', key: 'mesAnual', width: 12 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Fondo', key: 'fondo', width: 16 },
      { header: 'Cuenta', key: 'cuenta', width: 16 },
      { header: 'Método de pago', key: 'metodo', width: 20 },
      { header: 'Repartir', key: 'repartir', width: 10 },
      { header: 'Registrar solo', key: 'auto', width: 14 },
      { header: 'Activo', key: 'activo', width: 9 },
      { header: 'Desde', key: 'desde', width: 10 },
      { header: 'Creado', key: 'creado', width: 13, fmt: FMT_FECHA },
      { header: 'Meses omitidos', key: 'omitidos', width: 18 },
    ],
    d.recurrentes.map((r) => ({
      nombre: r.nombre,
      tipo: r.tipo === 'gasto' ? 'Gasto' : 'Ingreso',
      monto: r.monto,
      dia: r.dia,
      frecuencia: r.frecuencia === 'anual' ? 'Anual' : 'Mensual',
      mesAnual: r.frecuencia === 'anual' ? (r.mesAnual ?? null) : null,
      categoria: nombreDe(d.categorias, r.categoriaId),
      fondo: nombreDe(d.fondos, r.fondoId),
      cuenta: nombreDe(d.cuentas, r.cuentaId),
      metodo: nombreDe(d.metodos, r.metodoId),
      repartir: r.tipo === 'ingreso' ? (r.distribuir !== false ? 'Sí' : 'No') : '',
      auto: r.auto ? 'Sí' : 'No',
      activo: r.activo ? 'Sí' : 'No',
      desde: r.desde,
      creado: r.creado ? fechaExcel(r.creado) : null,
      omitidos: (r.omitidos ?? []).join(', '),
    })),
    { color: 'FFE09400' },
  )
  hoja(
    wb,
    'Escenarios',
    [
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Variación del ingreso', key: 'ingreso', width: 20, fmt: FMT_PCT },
      { header: 'Recorte del gasto', key: 'recorte', width: 18, fmt: FMT_PCT },
      { header: 'Ahorro extra (Bs)', key: 'aporte', width: 17, fmt: FMT_MONTO },
      { header: 'Fondo del ahorro extra', key: 'fondo', width: 20 },
      { header: 'Compras planeadas', key: 'compras', width: 60 },
    ],
    d.escenarios.map((e) => ({
      nombre: e.nombre,
      ingreso: e.ingresoPct,
      recorte: e.recortePct,
      aporte: e.aporteExtra,
      fondo: nombreDe(d.fondos, e.aporteFondoId),
      compras: e.compras.length ? JSON.stringify(e.compras.map((c) => ({ nombre: c.nombre, monto: c.monto, mes: c.mes, fondo: nombreDe(d.fondos, c.fondoId) }))) : '',
    })),
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
  const filas: string[] = [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto (Bs)', 'Método de pago', 'Cuenta', 'Cuenta destino', 'Fondo', 'Fondo origen', 'Repartir'].join(';')]
  const todos = [
    ...d.gastos.filter((g) => enRango(g.fecha)).map((g) => ({ f: g.fecha, r: [fmtFecha(g.fecha), 'Gasto', nombreDe(d.categorias, g.categoriaId), g.descripcion, numES(g.monto), nombreDe(d.metodos, g.metodoId), nombreDe(d.cuentas, g.cuentaId), '', nombreDe(d.fondos, g.fondoId), '', ''] })),
    ...d.movimientos.filter((m) => enRango(m.fecha)).map((m) => ({ f: m.fecha, r: [fmtFecha(m.fecha), TIPO_MOV[m.tipo], '', m.descripcion, numES(m.monto), '', nombreDe(d.cuentas, m.cuentaOrigenId), nombreDe(d.cuentas, m.cuentaDestinoId), m.tipo === 'ingreso' && m.distribuir !== false ? '' : nombreDe(d.fondos, m.fondoDestinoId ?? null), m.tipo === 'transferencia' ? nombreDe(d.fondos, m.fondoOrigenId ?? null) : '', m.tipo === 'ingreso' ? (m.distribuir !== false ? 'Sí' : 'No') : ''] })),
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
    ['2. Anota ingresos, transferencias y apartados en la hoja Movimientos. En Tipo escribe Ingreso, Transferencia o Ajuste.'],
    ['    Ingreso: en Repartir escribe Sí para repartirlo entre tus fondos o No (y el fondo destino si va a uno solo).'],
    ['    Apartar para una meta: Transferencia con la misma cuenta de origen y destino, y el fondo destino de la meta.'],
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
    wsM.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Ingreso,Transferencia,Ajuste"'] }
    wsM.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Cuentas', d.cuentas.length) }
    wsM.getCell(`F${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Cuentas', d.cuentas.length) }
    wsM.getCell(`G${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Distribución', d.fondos.length) }
    wsM.getCell(`H${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: lista('Distribución', d.fondos.length) }
    wsM.getCell(`I${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Sí,No"'] }
    wsM.getCell(`J${r}`).numFmt = FMT_MONTO
  }
  wsR.autoFilter = { from: 'A1', to: 'H1' }
  wsM.autoFilter = { from: 'A1', to: 'J1' }

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
function tabla(ws: XLSX.WorkSheet, encabezado: RegExp = RE_ENCABEZADO): Fila[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true })
  const h = rows.findIndex((r) => r.some((c) => typeof c === 'string' && encabezado.test(c.trim())))
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

/** Busca primero la columna con ese nombre exacto y luego una que empiece así. */
function colX(f: Fila, ...nombres: string[]): unknown {
  const keys = Object.keys(f)
  for (const n of nombres) {
    const k = keys.find((x) => x.trim().toLowerCase() === n.toLowerCase())
    if (k) return f[k]
  }
  return col(f, ...nombres)
}

const siNo = (v: unknown, def: boolean) => {
  const t = texto(v)
  if (!t) return def
  return /^(s[ií]|true|1|x)$/i.test(t)
}

export type ModoImport = 'combinar' | 'reemplazar'

export interface Muestra {
  fecha: string
  tipo: 'Gasto' | 'Ingreso' | 'Transferencia' | 'Ajuste'
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
  /** Cambios a cuentas, fondos o presupuestos que ya existían (para revisarlos antes de aplicar). */
  cambios: string[]
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

  // Repetidos: se comparan solo contra lo que ya existía antes de importar, contando cuántas veces aparece cada registro.
  // Así dos gastos iguales del mismo día dentro del archivo se importan los dos.
  const claveGasto = (g: Omit<Gasto, 'id'>) => `${g.fecha}|${g.monto.toFixed(2)}|${g.descripcion}|${g.categoriaId}`
  const claveMov = (m: Omit<Movimiento, 'id'>) =>
    `${m.fecha}|${m.monto.toFixed(2)}|${m.tipo}|${m.cuentaOrigenId ?? ''}|${m.cuentaDestinoId ?? ''}|${m.fondoOrigenId ?? ''}|${m.fondoDestinoId ?? ''}|${m.descripcion}`
  const contar = <T,>(xs: T[], k: (x: T) => string) => xs.reduce((mapa, x) => mapa.set(k(x), (mapa.get(k(x)) ?? 0) + 1), new Map<string, number>())
  const previosG = contar(base.gastos, claveGasto)
  const previosM = contar(base.movimientos, claveMov)
  const movimientosPrevios = base.movimientos.slice()
  const gastosNuevos = new Set<string>()
  const yaExiste = (mapa: Map<string, number>, k: string) => {
    const n = mapa.get(k) ?? 0
    if (n > 0) mapa.set(k, n - 1)
    return n > 0
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
      f = fondoNuevo({ id: uid(), nombre, icono: sugerirIcono(nombre), tipo: tipoFondoPorNombre(nombre) })
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
    if (yaExiste(previosG, claveGasto(g))) {
      r.duplicados++
      return
    }
    const id = uid()
    gastosNuevos.add(id)
    d.gastos.push({ ...g, id })
    r.gastos++
    rango(g.fecha)
    if (r.muestra.length < 6) r.muestra.push({ fecha: g.fecha, tipo: 'Gasto', descripcion: g.descripcion, detalle: nombreDe(d.categorias, g.categoriaId), monto: g.monto })
  }

  const agregarMov = (m: Omit<Movimiento, 'id'>) => {
    if (yaExiste(previosM, claveMov(m))) {
      r.duplicados++
      return
    }
    d.movimientos.push({ ...m, id: uid() })
    r.movimientos++
    rango(m.fecha)
    if (r.muestra.length < 6)
      r.muestra.push({
        fecha: m.fecha,
        tipo: m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'ajuste' ? 'Ajuste' : 'Transferencia',
        descripcion: m.descripcion,
        detalle:
          m.tipo === 'transferencia'
            ? m.cuentaOrigenId === m.cuentaDestinoId
              ? `Apartado a ${nombreDe(d.fondos, m.fondoDestinoId ?? null) || 'sin asignar'}`
              : `${nombreDe(d.cuentas, m.cuentaOrigenId)} a ${nombreDe(d.cuentas, m.cuentaDestinoId)}`
            : nombreDe(d.cuentas, m.cuentaDestinoId),
        monto: m.monto,
      })
  }

  return { d, cat, cta, fon, met, agregarGasto, agregarMov, gastosNuevos, movimientosPrevios }
}

function datosVacios(actual: Datos): Datos {
  return { categorias: [], metodos: [], cuentas: [], fondos: [], gastos: [], movimientos: [], recurrentes: [], escenarios: [], ajustes: { ...actual.ajustes } }
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
    cambios: [],
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
  const r = importarLibro(wb, base, nombre, esCSV ? 'CSV' : 'Excel')
  // Si el archivo no trae escenarios (Excel antiguo o CSV), al reemplazar se conservan los actuales, enlazados por nombre de fondo.
  if (modo === 'reemplazar' && r.datos.escenarios.length === 0) r.datos.escenarios = remapearEscenarios(actual.escenarios, actual, r.datos)
  return r
}

function remapearEscenarios(escenarios: Datos['escenarios'], origen: Datos, destino: Datos): Datos['escenarios'] {
  const fondo = (id: string | null) => {
    const nombre = origen.fondos.find((f) => f.id === id)?.nombre
    return nombre ? (destino.fondos.find((f) => f.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? null) : null
  }
  return escenarios.map((e) => ({ ...e, aporteFondoId: fondo(e.aporteFondoId), compras: e.compras.map((c) => ({ ...c, fondoId: fondo(c.fondoId) })) }))
}

function detectarSeparador(t: string): string {
  const linea = t.split(/\r?\n/)[0] ?? ''
  return (linea.match(/;/g)?.length ?? 0) >= (linea.match(/,/g)?.length ?? 0) ? ';' : ','
}

function importarLibro(wb: XLSX.WorkBook, base: Datos, archivo: string, formato: 'Excel' | 'CSV'): ResultadoImportacion {
  const r = resultadoBase(base, archivo, formato)
  const antes = { cuentas: new Set(base.cuentas.map((c) => c.id)), fondos: new Set(base.fondos.map((f) => f.id)), categorias: new Set(base.categorias.map((c) => c.id)) }
  const imp = crearImportador(base, r)
  const { d } = imp
  const fmtN = (n: number) => n.toLocaleString('es-BO', { maximumFractionDigits: 2 })
  /** Anota el cambio si el elemento ya existía y el valor es distinto. */
  const cambio = (existia: boolean, texto: string, viejo: unknown, nuevo: unknown) => {
    if (!existia || viejo === nuevo) return
    if (typeof viejo === 'number' && typeof nuevo === 'number' && Math.abs(viejo - nuevo) < 0.005) return
    r.cambios.push(`${texto}: ${typeof viejo === 'number' ? fmtN(viejo) : (viejo ?? '—')} → ${typeof nuevo === 'number' ? fmtN(nuevo) : (nuevo ?? '—')}`)
  }
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
        cambio(true, 'Ingreso mensual', d.ajustes.ingresoMensual, v)
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
        if (pres !== undefined && pres !== null && pres !== '') {
          cambio(antes.categorias.has(c.id), `Presupuesto de ${c.nombre}`, c.presupuesto, monto(pres))
          c.presupuesto = monto(pres)
        }
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
      if (saldo !== undefined && saldo !== null && saldo !== '') {
        cambio(antes.cuentas.has(c.id), `Saldo inicial de ${c.nombre}`, c.saldoInicial, monto(saldo))
        c.saldoInicial = monto(saldo)
      }
      const fecha = fechaISO(col(f, 'Fecha'))
      if (fecha) {
        cambio(antes.cuentas.has(c.id), `Fecha del saldo de ${c.nombre}`, c.fechaSaldo, fecha)
        c.fechaSaldo = fecha
      }
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
      const existia = antes.fondos.has(fo.id)
      if (typeof pctV === 'number') {
        const nuevoPct = pctV > 1 ? pctV / 100 : pctV
        cambio(existia, `% de ${fo.nombre}`, Math.round(fo.porcentaje * 1000) / 10, Math.round(nuevoPct * 1000) / 10)
        fo.porcentaje = nuevoPct
      }
      const incl = texto(col(f, 'Incluido'))
      if (incl) fo.enSaldoNeto = /^s[ií]/i.test(incl)
      const cuenta = imp.cta(texto(col(f, 'Cuenta')))
      if (cuenta) {
        cambio(existia, `Cuenta de ${fo.nombre}`, d.cuentas.find((c) => c.id === fo.cuentaId)?.nombre ?? null, cuenta.nombre)
        fo.cuentaId = cuenta.id
      }
      const ic = texto(col(f, 'Icono'))
      if (ic && ICONOS[ic]) fo.icono = ic
      const tipoF = texto(colX(f, 'Tipo de fondo'))
      if (tipoF) fo.tipo = /ahorr/i.test(tipoF) ? 'ahorro' : 'gasto'
      const si = colX(f, 'Saldo inicial (Bs)', 'Saldo inicial')
      if (si !== undefined && si !== null && si !== '') {
        cambio(existia, `Saldo inicial de ${fo.nombre}`, fo.saldoInicial, monto(si))
        fo.saldoInicial = monto(si)
      }
      const fs = fechaISO(colX(f, 'Fecha del saldo'))
      if (fs) fo.fechaSaldo = fs
      else if (!existia) fo.fechaSaldo = d.cuentas.find((c) => c.id === fo.cuentaId)?.fechaSaldo ?? fo.fechaSaldo
      const arch = texto(colX(f, 'Archivado'))
      fo.archivado = /^s[ií]/i.test(arch)
      const ap = colX(f, 'Aporte mensual (Bs)', 'Aporte mensual')
      if (ap !== undefined && ap !== null && ap !== '') fo.aporteMensual = monto(ap)
      const metaTipo = texto(colX(f, 'Meta'))
      if (metaTipo) {
        const emergencia = /emergencia/i.test(metaTipo)
        const fechaMeta = fechaISO(colX(f, 'Meta fecha'))
        const objetivoNuevo = emergencia ? 0 : monto(colX(f, 'Meta objetivo (Bs)', 'Meta objetivo'))
        cambio(existia && fo.meta?.tipo === 'monto' && !emergencia, `Meta de ${fo.nombre}`, fo.meta?.objetivo ?? 0, objetivoNuevo)
        fo.meta = {
          tipo: emergencia ? 'emergencia' : 'monto',
          objetivo: emergencia ? 0 : monto(colX(f, 'Meta objetivo (Bs)', 'Meta objetivo')),
          meses: emergencia ? Math.max(1, monto(colX(f, 'Meta meses de gasto', 'Meta meses')) || 3) : undefined,
          fecha: emergencia ? null : fechaMeta,
          creada: fechaISO(colX(f, 'Meta creada')) ?? fo.meta?.creada ?? hoyISO(),
        }
        fo.tipo = 'ahorro'
      }
    }
  }

  // Recurrentes (fijos)
  const wsRec = buscar('Recurrentes')
  if (wsRec) {
    for (const f of tabla(wsRec)) {
      const nombre = texto(colX(f, 'Nombre'))
      const montoR = monto(colX(f, 'Monto (Bs)', 'Monto'))
      if (!nombre || !(montoR > 0)) continue
      const tipoR: Recurrente['tipo'] = /ingreso/i.test(texto(colX(f, 'Tipo'))) ? 'ingreso' : 'gasto'
      const existente = d.recurrentes.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase() && x.tipo === tipoR)
      const anual = /anual/i.test(texto(colX(f, 'Frecuencia')))
      const rec: Recurrente = {
        id: existente?.id ?? uid(),
        nombre,
        tipo: tipoR,
        monto: montoR,
        dia: Math.min(31, Math.max(1, Math.round(monto(colX(f, 'Día', 'Dia')) || 1))),
        frecuencia: anual ? 'anual' : 'mensual',
        mesAnual: anual ? Math.min(12, Math.max(1, Math.round(monto(colX(f, 'Mes (anual)', 'Mes')) || 1))) : undefined,
        categoriaId: tipoR === 'gasto' ? (imp.cat(texto(colX(f, 'Categoría', 'Categoria')))?.id ?? null) : null,
        fondoId: imp.fon(texto(colX(f, 'Fondo')))?.id ?? null,
        cuentaId: imp.cta(texto(colX(f, 'Cuenta')))?.id ?? null,
        metodoId: imp.met(texto(colX(f, 'Método de pago', 'Metodo de pago')))?.id ?? null,
        distribuir: tipoR === 'ingreso' ? siNo(colX(f, 'Repartir'), true) : undefined,
        auto: siNo(colX(f, 'Registrar solo'), false),
        activo: siNo(colX(f, 'Activo'), true),
        desde: /^\d{4}-\d{2}$/.test(texto(colX(f, 'Desde'))) ? texto(colX(f, 'Desde')) : mesActual(),
        creado: fechaISO(colX(f, 'Creado')) ?? existente?.creado,
        omitidos: texto(colX(f, 'Meses omitidos')) ? texto(colX(f, 'Meses omitidos')).split(/[,;\s]+/).filter((x) => /^\d{4}-\d{2}$/.test(x)) : (existente?.omitidos ?? []),
      }
      if (existente) Object.assign(existente, rec)
      else d.recurrentes.push(rec)
      r.configActualizada.push('gastos fijos')
    }
  }

  // Escenarios de proyección
  const wsEsc = buscar('Escenarios')
  if (wsEsc) {
    const pctX = (v: unknown) => {
      const n = monto(v)
      return Math.abs(n) > 1 ? n / 100 : n
    }
    for (const f of tabla(wsEsc, /^nombre$/i)) {
      const nombre = texto(colX(f, 'Nombre'))
      if (!nombre) continue
      let compras: Escenario['compras'] = []
      try {
        const crudo = texto(colX(f, 'Compras planeadas'))
        if (crudo) {
          compras = (JSON.parse(crudo) as { nombre?: string; monto?: number; mes?: string; fondo?: string }[])
            .filter((c) => c && c.nombre && Number(c.monto) > 0 && /^\d{4}-\d{2}$/.test(String(c.mes)))
            .map((c) => ({ id: uid(), nombre: String(c.nombre), monto: Number(c.monto), mes: String(c.mes), fondoId: imp.fon(c.fondo ?? '')?.id ?? null }))
        }
      } catch {
        compras = []
      }
      const esc: Escenario = {
        id: d.escenarios.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? uid(),
        nombre,
        ingresoPct: pctX(colX(f, 'Variación del ingreso')),
        recortePct: pctX(colX(f, 'Recorte del gasto')),
        aporteExtra: monto(colX(f, 'Ahorro extra (Bs)', 'Ahorro extra')),
        aporteFondoId: imp.fon(texto(colX(f, 'Fondo del ahorro extra')))?.id ?? null,
        compras,
      }
      const i = d.escenarios.findIndex((x) => x.id === esc.id)
      if (i >= 0) d.escenarios[i] = esc
      else d.escenarios.push(esc)
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
      fondoId: imp.fon(texto(colX(f, 'Fondo')))?.id ?? null,
      recurrenteId: fijoId(texto(colX(f, 'Fijo')), 'gasto'),
    })
  }

  function fijoId(nombre: string, tipo: Recurrente['tipo']): string | null {
    if (!nombre) return null
    return d.recurrentes.find((x) => x.tipo === tipo && x.nombre.toLowerCase() === nombre.toLowerCase())?.id ?? null
  }

  function leerMov(f: Fila) {
    const fecha = fechaISO(col(f, 'Fecha'))
    const tipoT = texto(col(f, 'Tipo'))
    const tipo: Movimiento['tipo'] = /transf/i.test(tipoT) ? 'transferencia' : /ajuste/i.test(tipoT) ? 'ajuste' : 'ingreso'
    const crudo = monto(col(f, 'Monto', 'Importe'))
    const m = tipo === 'ajuste' ? crudo : Math.abs(crudo)
    if (!fecha || !m || (tipo !== 'ajuste' && !(m > 0))) {
      r.omitidos++
      return
    }
    const origenNombre = texto(colX(f, 'Cuenta origen')) || (tipo === 'transferencia' ? texto(colX(f, 'Cuenta')) : '')
    const destinoNombre = texto(colX(f, 'Cuenta destino')) || (tipo !== 'transferencia' ? texto(colX(f, 'Cuenta')) : '')
    const fondoDestino = imp.fon(texto(colX(f, 'Fondo destino', 'Fondo')))?.id ?? null
    const fondoOrigen = imp.fon(texto(colX(f, 'Fondo origen')))?.id ?? null
    const distribuir = tipo === 'ingreso' ? siNo(colX(f, 'Repartir'), !fondoDestino) : undefined
    let reparto: Record<string, number> | null = null
    const repTxt = texto(colX(f, 'Reparto', 'Reparto propio'))
    if (tipo === 'ingreso' && distribuir && repTxt) {
      reparto = {}
      for (const parte of repTxt.split(';')) {
        const mm = parte.trim().match(/^(.*?)\s+(-?[\d.,]+)\s*%$/)
        if (!mm) continue
        const fo = imp.fon(mm[1].trim())
        if (fo) reparto[fo.id] = num(mm[2]) / 100
      }
      if (Object.keys(reparto).length === 0) reparto = null
    }
    // Sin reparto en el archivo: se guardan los porcentajes de los fondos tal como quedaron al importar.
    if (tipo === 'ingreso' && distribuir && !reparto) reparto = repartoActual(d.fondos)
    imp.agregarMov({
      fecha,
      tipo,
      descripcion: texto(col(f, 'Descripci', 'Detalle', 'Concepto')),
      cuentaOrigenId: tipo === 'transferencia' ? (imp.cta(origenNombre)?.id ?? null) : null,
      cuentaDestinoId: imp.cta(destinoNombre)?.id ?? null,
      monto: Math.round(m * 100) / 100,
      distribuir,
      reparto,
      fondoOrigenId: tipo === 'transferencia' ? fondoOrigen : null,
      fondoDestinoId: tipo === 'ingreso' && distribuir ? null : fondoDestino,
      recurrenteId: tipo === 'ingreso' ? fijoId(texto(colX(f, 'Fijo')), 'ingreso') : null,
    })
  }

  // Un Excel de antes de la actualización trae el ahorro como gasto: se convierte igual que en la migración.
  const conv = convertirAhorroEnAportes(d, { soloGastos: imp.gastosNuevos, existentes: imp.movimientosPrevios })
  if (conv.convertidos > 0) {
    r.avisos.push(
      `${conv.convertidos} gastos de la categoría Ahorro se convirtieron en aportes al fondo ${conv.fondoAhorro}${conv.repetidos ? ` (${conv.repetidos} ya estaban registrados)` : ''}.`,
    )
    r.duplicados += conv.repetidos
    r.categoriasNuevas = r.categoriasNuevas.filter((n) => !conv.categoriasEliminadas.includes(n))
  }
  r.gastos = d.gastos.filter((g) => imp.gastosNuevos.has(g.id)).length
  r.movimientos = d.movimientos.length - imp.movimientosPrevios.length

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
  // Un respaldo sin "recurrentes" es de la versión anterior: se migra (el ahorro registrado como gasto pasa a aportes).
  const { datos: entrante, informe } = migrar(x, Array.isArray(x.recurrentes) ? 2 : 1)
  entrante.ajustes = { ...entrante.ajustes, tema: actual.ajustes.tema }
  const avisoMigracion = informe && informe.convertidos > 0 ? `Es un respaldo de la versión anterior: ${informe.convertidos} registros de ahorro se convirtieron en aportes al fondo ${informe.fondoAhorro}.` : null

  if (modo === 'reemplazar') {
    const r = resultadoBase(entrante, archivo, 'Respaldo JSON')
    r.gastos = entrante.gastos.length
    r.movimientos = entrante.movimientos.length
    r.categoriasNuevas = entrante.categorias.map((c) => c.nombre)
    r.cuentasNuevas = entrante.cuentas.map((c) => c.nombre)
    r.fondosNuevos = entrante.fondos.map((c) => c.nombre)
    if (entrante.recurrentes.length) r.configActualizada.push(`${entrante.recurrentes.length} gastos e ingresos fijos`)
    if (avisoMigracion) r.avisos.push(avisoMigracion)
    const fechas = [...entrante.gastos.map((g) => g.fecha), ...entrante.movimientos.map((m) => m.fecha)].sort()
    r.desde = fechas[0] ?? null
    r.hasta = fechas.at(-1) ?? null
    r.muestra = entrante.gastos.slice(-6).map((g) => ({ fecha: g.fecha, tipo: 'Gasto', descripcion: g.descripcion, detalle: nombreDe(entrante.categorias, g.categoriaId), monto: g.monto }))
    return r
  }

  // Combinar: se emparejan categorías, cuentas, fondos y métodos por nombre.
  const r = resultadoBase(base, archivo, 'Respaldo JSON')
  if (avisoMigracion) r.avisos.push(avisoMigracion)
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
  const n = (arr: { id: string; nombre: string }[], id: string | null | undefined) => nombreDe(arr, id ?? null)
  for (const f of entrante.fondos) {
    const nuevo = imp.fon(f.nombre)
    if (nuevo && r.fondosNuevos.includes(f.nombre)) {
      Object.assign(nuevo, {
        tipo: f.tipo,
        porcentaje: f.porcentaje,
        enSaldoNeto: f.enSaldoNeto,
        icono: f.icono,
        color: f.color,
        meta: f.meta,
        aporteMensual: f.aporteMensual,
        saldoInicial: f.saldoInicial,
        fechaSaldo: f.fechaSaldo,
        archivado: f.archivado,
        cuentaId: imp.cta(n(entrante.cuentas, f.cuentaId))?.id ?? null,
      })
    }
  }
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
    const reparto = m.reparto ? Object.fromEntries(Object.entries(m.reparto).map(([id, p]) => [imp.fon(n(entrante.fondos, id))?.id ?? id, p])) : null
    imp.agregarMov({
      fecha: m.fecha,
      tipo: m.tipo,
      descripcion: m.descripcion,
      cuentaOrigenId: imp.cta(n(entrante.cuentas, m.cuentaOrigenId))?.id ?? null,
      cuentaDestinoId: imp.cta(n(entrante.cuentas, m.cuentaDestinoId))?.id ?? null,
      monto: m.monto,
      distribuir: m.distribuir,
      reparto,
      fondoOrigenId: imp.fon(n(entrante.fondos, m.fondoOrigenId))?.id ?? null,
      fondoDestinoId: imp.fon(n(entrante.fondos, m.fondoDestinoId))?.id ?? null,
      recurrenteId: null,
    })
  }
  for (const e of remapearEscenarios(entrante.escenarios, entrante, base)) {
    if (!base.escenarios.some((x) => x.nombre.toLowerCase() === e.nombre.toLowerCase())) base.escenarios.push({ ...e, id: uid() })
  }
  for (const rec of entrante.recurrentes) {
    if (base.recurrentes.some((x) => x.nombre.toLowerCase() === rec.nombre.toLowerCase() && x.tipo === rec.tipo)) continue
    base.recurrentes.push({
      ...rec,
      id: uid(),
      categoriaId: imp.cat(n(entrante.categorias, rec.categoriaId))?.id ?? null,
      fondoId: imp.fon(n(entrante.fondos, rec.fondoId))?.id ?? null,
      cuentaId: imp.cta(n(entrante.cuentas, rec.cuentaId))?.id ?? null,
      metodoId: imp.met(n(entrante.metodos, rec.metodoId))?.id ?? null,
    })
    r.configActualizada.push('gastos fijos')
  }
  return r
}

