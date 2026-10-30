/**
 * Motor de cálculo.
 *
 * Conceptos:
 * - Cuenta: dónde está el dinero. Su saldo = saldo inicial (al inicio de `fechaSaldo`) + movimientos desde esa fecha.
 * - Fondo: para qué es el dinero. Vive en una cuenta y su saldo se arrastra de mes a mes:
 *   saldo inicial + reparto de ingresos + transferencias recibidas − transferencias enviadas − gastos.
 * - Sin asignar: dinero en cuentas que no pertenece a ningún fondo (saldo total de cuentas − saldo total de fondos).
 * - Meta: objetivo de un fondo de ahorro. Avanza solo con el saldo de su fondo.
 */
import { addMonths, differenceInCalendarDays, differenceInCalendarMonths, format, getDaysInMonth, isBefore, parseISO, startOfMonth } from 'date-fns'
import type { Categoria, Cuenta, Datos, Escenario, Estado, Fondo, Gasto, Movimiento, Recurrente } from '../types'
import { hoyISO, mesActual, mesDe } from './format'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const r2 = (n: number) => Math.round(n * 100) / 100
const EPS = 0.005

/* ═════════════════════════ Fechas ═════════════════════════ */

export function mesMas(mes: string, n: number): string {
  return format(addMonths(parseISO(`${mes}-01`), n), 'yyyy-MM')
}

export function mesesPrevios(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => mesMas(mes, -(n - i)))
}

export function mesesDesde(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => mesMas(mes, i + 1))
}

export function diasDelMes(mes: string): number {
  return getDaysInMonth(parseISO(`${mes}-01`))
}

export function finDeMes(mes: string): string {
  return `${mes}-${String(diasDelMes(mes)).padStart(2, '0')}`
}

export function inicioMes(mes: string): Date {
  return startOfMonth(parseISO(`${mes}-01`))
}

function diasTranscurridos(mes: string, hoy = new Date()): { diasMes: number; transcurridos: number } {
  const inicio = parseISO(`${mes}-01`)
  const diasMes = getDaysInMonth(inicio)
  if (isBefore(hoy, inicio)) return { diasMes, transcurridos: 0 }
  if (!isBefore(hoy, addMonths(inicio, 1))) return { diasMes, transcurridos: diasMes }
  return { diasMes, transcurridos: Math.min(diasMes, differenceInCalendarDays(hoy, inicio) + 1) }
}

/** Meses completos entre el mes de `desde` y el mes de `hasta` (0 si es el mismo mes). */
export function mesesEntre(desde: string, hasta: string): number {
  return differenceInCalendarMonths(parseISO(hasta.length === 7 ? `${hasta}-01` : hasta), parseISO(desde.length === 7 ? `${desde}-01` : desde))
}

/* ═════════════════════════ Asientos (libro mayor) ═════════════════════════ */

export interface Asiento {
  fecha: string
  id: string | null
  monto: number
}

/** Cuánto de un ingreso va a cada fondo. */
export function repartoIngreso(d: Pick<Datos, 'fondos'>, m: Pick<Movimiento, 'tipo' | 'monto' | 'distribuir' | 'reparto' | 'fondoDestinoId'>): Record<string, number> {
  if (m.tipo !== 'ingreso') return {}
  if (m.distribuir === false) return m.fondoDestinoId ? { [m.fondoDestinoId]: m.monto } : {}
  const out: Record<string, number> = {}
  const ids = new Set(d.fondos.map((f) => f.id))
  const pcts = m.reparto ?? Object.fromEntries(d.fondos.filter((f) => !f.archivado).map((f) => [f.id, f.porcentaje]))
  for (const [id, p] of Object.entries(pcts)) {
    if (ids.has(id) && p > 0) out[id] = r2(m.monto * p)
  }
  return out
}

/** Asientos que afectan el saldo de las cuentas. */
export function asientosCuentas(d: Pick<Datos, 'gastos' | 'movimientos'>): Asiento[] {
  const out: Asiento[] = []
  for (const g of d.gastos) if (g.cuentaId) out.push({ fecha: g.fecha, id: g.cuentaId, monto: -g.monto })
  for (const m of d.movimientos) {
    if (m.tipo === 'ingreso' || m.tipo === 'ajuste') {
      if (m.cuentaDestinoId) out.push({ fecha: m.fecha, id: m.cuentaDestinoId, monto: m.monto })
    } else {
      if (m.cuentaOrigenId) out.push({ fecha: m.fecha, id: m.cuentaOrigenId, monto: -m.monto })
      if (m.cuentaDestinoId) out.push({ fecha: m.fecha, id: m.cuentaDestinoId, monto: m.monto })
    }
  }
  return out
}

/** Asientos que afectan el saldo de los fondos (id null = sin asignar, no se incluye). */
export function asientosFondos(d: Pick<Datos, 'gastos' | 'movimientos' | 'fondos'>): Asiento[] {
  const out: Asiento[] = []
  for (const g of d.gastos) if (g.fondoId) out.push({ fecha: g.fecha, id: g.fondoId, monto: -g.monto })
  for (const m of d.movimientos) {
    if (m.tipo === 'ingreso') {
      for (const [id, v] of Object.entries(repartoIngreso(d, m))) out.push({ fecha: m.fecha, id, monto: v })
    } else if (m.tipo === 'ajuste') {
      if (m.fondoDestinoId) out.push({ fecha: m.fecha, id: m.fondoDestinoId, monto: m.monto })
    } else {
      if (m.fondoOrigenId) out.push({ fecha: m.fecha, id: m.fondoOrigenId, monto: -m.monto })
      if (m.fondoDestinoId) out.push({ fecha: m.fecha, id: m.fondoDestinoId, monto: m.monto })
    }
  }
  return out
}

/**
 * Saldo al final del día `fecha`, dado un saldo base al inicio de `base`.
 * Si `fecha` es anterior a `base`, se descuentan los asientos entre ambas fechas.
 */
function saldoEn(asientos: Asiento[], id: string, saldoBase: number, base: string, fecha: string): number {
  let s = saldoBase
  if (fecha >= base) {
    for (const a of asientos) if (a.id === id && a.fecha >= base && a.fecha <= fecha) s += a.monto
  } else {
    for (const a of asientos) if (a.id === id && a.fecha > fecha && a.fecha < base) s -= a.monto
  }
  return r2(s)
}

/** Fecha del saldo inicial de un fondo (propia del fondo). */
function baseFondo(_d: Pick<Datos, 'cuentas'>, f: Fondo): string {
  return f.fechaSaldo || '0000-01-01'
}

export function saldoCuentaEn(d: Datos, c: Cuenta, fecha: string, asientos = asientosCuentas(d)): number {
  return saldoEn(asientos, c.id, c.saldoInicial, c.fechaSaldo, fecha)
}

export function saldoFondoEn(d: Datos, f: Fondo, fecha: string, asientos = asientosFondos(d)): number {
  return saldoEn(asientos, f.id, f.saldoInicial, baseFondo(d, f), fecha)
}

/** Fecha lejana para "saldo actual" (incluye registros con fecha futura). */
const SIEMPRE = '9999-12-31'

/* ═════════════════════════ Cuentas ═════════════════════════ */

export interface SaldoCuenta {
  cuenta: Cuenta
  saldoInicial: number
  ingresos: number
  gastos: number
  transfRecibidas: number
  transfEnviadas: number
  ajustes: number
  saldoActual: number
  fondos: Fondo[]
  /** Suma de los saldos de los fondos que viven en esta cuenta. */
  enFondos: number
  /** Saldo real − saldo de sus fondos. Positivo: dinero libre o por repartir. Negativo: faltan fondos por mover a esta cuenta. */
  libre: number
  /** Registros anteriores a la fecha del saldo (no cambian el saldo actual porque el saldo inicial ya los incluye). */
  anterioresAlSaldo: number
}

export function saldosCuentas(d: Datos): SaldoCuenta[] {
  const af = asientosFondos(d)
  return d.cuentas.map((c) => {
    const desde = c.fechaSaldo
    const enRango = (f: string) => f >= desde
    const ingresos = sum(d.movimientos.filter((m) => m.tipo === 'ingreso' && m.cuentaDestinoId === c.id && enRango(m.fecha)).map((m) => m.monto))
    const ajustes = sum(d.movimientos.filter((m) => m.tipo === 'ajuste' && m.cuentaDestinoId === c.id && enRango(m.fecha)).map((m) => m.monto))
    const gastos = sum(d.gastos.filter((g) => g.cuentaId === c.id && enRango(g.fecha)).map((g) => g.monto))
    const transf = d.movimientos.filter((m) => m.tipo === 'transferencia' && enRango(m.fecha))
    const transfRecibidas = sum(transf.filter((m) => m.cuentaDestinoId === c.id && m.cuentaOrigenId !== c.id).map((m) => m.monto))
    const transfEnviadas = sum(transf.filter((m) => m.cuentaOrigenId === c.id && m.cuentaDestinoId !== c.id).map((m) => m.monto))
    const saldoActual = r2(c.saldoInicial + ingresos + ajustes - gastos + transfRecibidas - transfEnviadas)
    const fondos = d.fondos.filter((f) => f.cuentaId === c.id)
    const enFondos = r2(sum(fondos.map((f) => saldoFondoEn(d, f, SIEMPRE, af))))
    const anterioresAlSaldo =
      d.gastos.filter((g) => g.cuentaId === c.id && g.fecha < desde).length +
      d.movimientos.filter((m) => (m.cuentaDestinoId === c.id || m.cuentaOrigenId === c.id) && m.fecha < desde).length
    return { cuenta: c, saldoInicial: c.saldoInicial, ingresos, gastos, transfRecibidas, transfEnviadas, ajustes, saldoActual, fondos, enFondos, libre: r2(saldoActual - enFondos), anterioresAlSaldo }
  })
}

export interface TransferenciaSugerida {
  origen: Cuenta
  destino: Cuenta
  monto: number
}

/** Transferencias entre cuentas para que cada cuenta tenga el dinero de los fondos que guarda. */
export function cuadreCuentas(saldos: SaldoCuenta[]): TransferenciaSugerida[] {
  const sobra = saldos.filter((s) => s.libre > EPS).map((s) => ({ c: s.cuenta, v: s.libre }))
  const falta = saldos.filter((s) => s.libre < -EPS).map((s) => ({ c: s.cuenta, v: -s.libre }))
  const out: TransferenciaSugerida[] = []
  for (const f of falta.sort((a, b) => b.v - a.v)) {
    for (const s of sobra.sort((a, b) => b.v - a.v)) {
      if (f.v < EPS) break
      if (s.v < EPS) continue
      const m = r2(Math.min(f.v, s.v))
      out.push({ origen: s.c, destino: f.c, monto: m })
      f.v -= m
      s.v -= m
    }
  }
  return out
}

/* ═════════════════════════ Fondos ═════════════════════════ */

export interface FilaFondo {
  fondo: Fondo
  cuenta: Cuenta | null
  /** Saldo actual (arrastrado). */
  saldo: number
  /** Saldo al cierre del mes anterior al consultado. */
  saldoAnterior: number
  /** Entradas del mes: reparto de ingresos, transferencias y ajustes positivos. */
  entradas: number
  /** Gastos del mes pagados con este fondo. */
  gastado: number
  /** Otras salidas del mes (transferencias a otros fondos). */
  salidas: number
  /** Saldo al cierre del mes consultado. */
  saldoMes: number
  pctUsado: number | null
  estado: Estado
}

export interface ResumenFondos {
  filas: FilaFondo[]
  totalPct: number
  ingresoMes: number
  ingresoDistribuido: number
  saldoTotalCuentas: number
  saldoTotalFondos: number
  sinAsignar: number
  /** Suma de saldos de fondos marcados "en saldo neto". */
  saldoNeto: number
  ahorroTotal: number
}

export function resumenFondos(d: Datos, mes: string): ResumenFondos {
  const af = asientosFondos(d)
  const ini = `${mes}-01`
  const fin = finDeMes(mes)
  const diaAntes = format(new Date(parseISO(ini).getTime() - 864e5), 'yyyy-MM-dd')
  const filas: FilaFondo[] = d.fondos
    .filter((f) => !f.archivado)
    .map((f) => {
      const base = baseFondo(d, f)
      const delMes = af.filter((a) => a.id === f.id && a.fecha >= ini && a.fecha <= fin && a.fecha >= base)
      const gastado = sum(d.gastos.filter((g) => g.fondoId === f.id && g.fecha >= ini && g.fecha <= fin && g.fecha >= base).map((g) => g.monto))
      const entradas = sum(delMes.filter((a) => a.monto > 0).map((a) => a.monto))
      const salidasTot = -sum(delMes.filter((a) => a.monto < 0).map((a) => a.monto))
      const saldoAnterior = saldoFondoEn(d, f, diaAntes, af)
      const saldoMes = saldoFondoEn(d, f, fin, af)
      const disponible = saldoAnterior + entradas
      const pctUsado = disponible > 0 ? gastado / disponible : null
      const estado: Estado = saldoMes < -EPS ? 'Excedido' : (pctUsado ?? 0) > 0.85 && f.tipo === 'gasto' ? 'En riesgo' : 'En control'
      return {
        fondo: f,
        cuenta: d.cuentas.find((c) => c.id === f.cuentaId) ?? null,
        saldo: saldoFondoEn(d, f, SIEMPRE, af),
        saldoAnterior,
        entradas: r2(entradas),
        gastado: r2(gastado),
        salidas: r2(salidasTot - gastado),
        saldoMes,
        pctUsado,
        estado,
      }
    })
  const saldoTotalCuentas = r2(sum(saldosCuentas(d).map((c) => c.saldoActual)))
  const saldoTotalFondos = r2(sum(d.fondos.map((f) => saldoFondoEn(d, f, SIEMPRE, af))))
  const ingresos = d.movimientos.filter((m) => m.tipo === 'ingreso' && mesDe(m.fecha) === mes)
  return {
    filas,
    totalPct: sum(d.fondos.filter((f) => !f.archivado).map((f) => f.porcentaje)),
    ingresoMes: sum(ingresos.map((m) => m.monto)),
    ingresoDistribuido: sum(ingresos.filter((m) => m.distribuir !== false).map((m) => m.monto)),
    saldoTotalCuentas,
    saldoTotalFondos,
    sinAsignar: r2(saldoTotalCuentas - saldoTotalFondos),
    saldoNeto: r2(sum(filas.filter((f) => f.fondo.enSaldoNeto).map((f) => f.saldo))),
    ahorroTotal: r2(sum(filas.filter((f) => f.fondo.tipo === 'ahorro').map((f) => f.saldo))),
  }
}

/* ═════════════════════════ Ingresos y gastos del mes ═════════════════════════ */

/** Ingreso registrado en un mes (todos los ingresos, se distribuyan o no). */
export function ingresoMes(d: Pick<Datos, 'movimientos'>, mes: string): number {
  return sum(d.movimientos.filter((m) => m.tipo === 'ingreso' && mesDe(m.fecha) === mes).map((m) => m.monto))
}

/** Ingreso esperado de un mes: recurrentes de ingreso que ocurren ese mes o, si no hay, el de Ajustes. */
export function ingresoEsperado(d: Datos, mes: string, soloDistribuible = false): number {
  const recs = d.recurrentes.filter((r) => r.activo && r.tipo === 'ingreso' && (!soloDistribuible || r.distribuir !== false))
  if (d.recurrentes.some((r) => r.activo && r.tipo === 'ingreso')) return sum(recs.filter((r) => fechaOcurrencia(r, mes)).map((r) => r.monto))
  return d.ajustes.ingresoMensual
}

/** Ingreso para análisis: el registrado o, si no hay, el esperado. */
export function ingresoEfectivo(d: Datos, mes: string): number {
  const r = ingresoMes(d, mes)
  return r > 0 ? r : ingresoEsperado(d, mes)
}

export function gastoMes(d: Pick<Datos, 'gastos'>, mes: string, categoriaId?: string): number {
  return sum(d.gastos.filter((g) => mesDe(g.fecha) === mes && (categoriaId === undefined || g.categoriaId === categoriaId)).map((g) => g.monto))
}

export function presupuestoTotal(d: Pick<Datos, 'categorias'>): number {
  return sum(d.categorias.map((c) => c.presupuesto))
}

export function promedio3Meses(d: Pick<Datos, 'gastos'>, mes: string, categoriaId?: string): number {
  return sum(mesesPrevios(mes, 3).map((m) => gastoMes(d, m, categoriaId))) / 3
}

/** Gasto mensual promedio de los últimos 3 meses con gastos (antes de `mes`). Si no hay historial, el presupuesto. */
export function gastoPromedioMensual(d: Datos, mes = mesActual()): number {
  const previos = mesesPrevios(mes, 6).map((m) => gastoMes(d, m)).filter((v) => v > 0).slice(-3)
  if (previos.length) return sum(previos) / previos.length
  const actual = gastoMes(d, mes)
  return Math.max(presupuestoTotal(d), actual)
}

export interface FilaCategoria {
  categoria: Categoria
  presupuesto: number
  gastado: number
  disponible: number
  pctUsado: number | null
  proyeccion: number
  prom3m: number
  estado: Estado
}

export interface ResumenMes {
  mes: string
  gasto: number
  presupuesto: number
  disponible: number
  pctUsado: number | null
  diasMes: number
  diasTranscurridos: number
  proyeccionCierre: number
  ingreso: number
  ingresoRegistrado: number
  ingresoEsEsperado: boolean
  ahorroProyectado: number
  tasaAhorroProyectada: number | null
  ahorroReal: number
  tasaAhorroReal: number | null
  categoriaMayor: Categoria | null
  estado: Estado
  categorias: FilaCategoria[]
  saldoTotalCuentas: number
}

export function resumenMes(d: Datos, mes: string): ResumenMes {
  const gasto = gastoMes(d, mes)
  const presupuesto = presupuestoTotal(d)
  const { diasMes, transcurridos } = diasTranscurridos(mes)
  const proyeccionCierre = transcurridos === 0 ? 0 : (gasto / transcurridos) * diasMes
  const ingresoRegistrado = ingresoMes(d, mes)
  const ingreso = ingresoEfectivo(d, mes)
  const ahorroProyectado = ingreso - proyeccionCierre
  const ahorroReal = ingreso - gasto

  const categorias: FilaCategoria[] = d.categorias.map((c) => {
    const gastado = gastoMes(d, mes, c.id)
    const proyeccion = transcurridos === 0 ? 0 : (gastado / transcurridos) * diasMes
    const estado: Estado = gastado > c.presupuesto + EPS ? 'Excedido' : proyeccion > c.presupuesto + EPS ? 'En riesgo' : 'En control'
    return {
      categoria: c,
      presupuesto: c.presupuesto,
      gastado,
      disponible: c.presupuesto - gastado,
      pctUsado: c.presupuesto > 0 ? gastado / c.presupuesto : null,
      proyeccion,
      prom3m: promedio3Meses(d, mes, c.id),
      estado,
    }
  })
  const mayor = categorias.reduce<FilaCategoria | null>((a, b) => (b.gastado > 0 && (!a || b.gastado > a.gastado) ? b : a), null)
  const estado: Estado = gasto > presupuesto + EPS ? 'Excedido' : proyeccionCierre > presupuesto + EPS ? 'En riesgo' : 'En control'

  return {
    mes,
    gasto,
    presupuesto,
    disponible: presupuesto - gasto,
    pctUsado: presupuesto > 0 ? gasto / presupuesto : null,
    diasMes,
    diasTranscurridos: transcurridos,
    proyeccionCierre,
    ingreso,
    ingresoRegistrado,
    ingresoEsEsperado: ingresoRegistrado <= 0,
    ahorroProyectado,
    tasaAhorroProyectada: ingreso > 0 ? ahorroProyectado / ingreso : null,
    ahorroReal,
    tasaAhorroReal: ingreso > 0 ? ahorroReal / ingreso : null,
    categoriaMayor: mayor?.categoria ?? null,
    estado,
    categorias,
    saldoTotalCuentas: r2(sum(saldosCuentas(d).map((c) => c.saldoActual))),
  }
}

/* ═════════════════════════ Recurrentes ═════════════════════════ */

/** Fecha en que ocurre un recurrente en un mes, o null si no ocurre ese mes. */
export function fechaOcurrencia(r: Recurrente, mes: string): string | null {
  if (mes < r.desde) return null
  if (r.frecuencia === 'anual' && Number(mes.slice(5, 7)) !== (r.mesAnual ?? Number(r.desde.slice(5, 7)))) return null
  const dia = Math.min(Math.max(1, r.dia), diasDelMes(mes))
  return `${mes}-${String(dia).padStart(2, '0')}`
}

/**
 * Un recurrente está registrado en el mes si hay un registro enlazado a él o, si no hay enlace,
 * un registro del mismo tipo con la misma descripción (por ejemplo, anotado a mano o importado de Excel).
 */
export function estaRegistrado(d: Pick<Datos, 'gastos' | 'movimientos'>, r: Recurrente, mes: string): boolean {
  const nombre = r.nombre.trim().toLowerCase()
  const igual = (desc: string) => desc.trim().toLowerCase() === nombre
  if (r.tipo === 'gasto') return d.gastos.some((g) => mesDe(g.fecha) === mes && (g.recurrenteId === r.id || (!g.recurrenteId && igual(g.descripcion))))
  return d.movimientos.some((m) => m.tipo === 'ingreso' && mesDe(m.fecha) === mes && (m.recurrenteId === r.id || (!m.recurrenteId && igual(m.descripcion))))
}

export interface Ocurrencia {
  recurrente: Recurrente
  fecha: string
  mes: string
  vencida: boolean
}

/** Ocurrencias sin registrar desde hace hasta 2 meses hasta fin del mes actual. */
export function ocurrenciasPendientes(d: Pick<Datos, 'gastos' | 'movimientos' | 'recurrentes'>, hoy = hoyISO()): Ocurrencia[] {
  const mes = mesDe(hoy)
  const meses = [...mesesPrevios(mes, 2), mes]
  const out: Ocurrencia[] = []
  for (const r of d.recurrentes) {
    if (!r.activo) continue
    for (const m of meses) {
      const fecha = fechaOcurrencia(r, m)
      if (!fecha || r.omitidos?.includes(m) || estaRegistrado(d, r, m)) continue
      out.push({ recurrente: r, fecha, mes: m, vencida: fecha <= hoy })
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function registroDeRecurrente(
  r: Recurrente,
  fecha: string,
  fondos: Fondo[] = [],
): { tipo: 'gasto'; gasto: Omit<Gasto, 'id'> } | { tipo: 'ingreso'; movimiento: Omit<Movimiento, 'id'> } {
  if (r.tipo === 'gasto') {
    return {
      tipo: 'gasto',
      gasto: { fecha, categoriaId: r.categoriaId ?? '', descripcion: r.nombre, monto: r.monto, metodoId: r.metodoId, cuentaId: r.cuentaId, fondoId: r.fondoId, recurrenteId: r.id },
    }
  }
  const distribuir = r.distribuir !== false
  return {
    tipo: 'ingreso',
    movimiento: {
      fecha,
      tipo: 'ingreso',
      descripcion: r.nombre,
      cuentaOrigenId: null,
      cuentaDestinoId: r.cuentaId,
      monto: r.monto,
      distribuir,
      // Se guardan los porcentajes vigentes: cambiarlos después no reescribe este ingreso.
      reparto: distribuir ? Object.fromEntries(fondos.filter((f) => !f.archivado && f.porcentaje > 0).map((f) => [f.id, f.porcentaje])) : null,
      fondoOrigenId: null,
      fondoDestinoId: distribuir ? null : r.fondoId,
      recurrenteId: r.id,
    },
  }
}

/** Gastos fijos del mes: total, pagados y pendientes. */
export function fijosDelMes(d: Datos, mes: string) {
  const recs = d.recurrentes.filter((r) => r.activo && r.tipo === 'gasto')
  const items = recs
    .map((r) => ({ r, fecha: fechaOcurrencia(r, mes) }))
    .filter((x): x is { r: Recurrente; fecha: string } => x.fecha !== null)
    .map((x) => ({ ...x, pagado: estaRegistrado(d, x.r, mes) }))
  return {
    items,
    total: sum(items.map((x) => x.r.monto)),
    pendiente: sum(items.filter((x) => !x.pagado).map((x) => x.r.monto)),
  }
}

/* ═════════════════════════ Puedes gastar ═════════════════════════ */

export interface PuedesGastar {
  /** Saldo de los fondos de gasto. */
  enFondosDeGasto: number
  /** Gastos fijos del mes aún sin pagar que salen de fondos de gasto (o sin fondo). */
  fijosPendientes: number
  /** Lo que puedes gastar sin tocar ahorros ni fijos. */
  disponible: number
  diasRestantes: number
  porDia: number
  /** No hay fondos de gasto configurados: se usa el presupuesto restante. */
  segunPresupuesto: boolean
}

export function puedesGastar(d: Datos, hoy = hoyISO()): PuedesGastar {
  const mes = mesDe(hoy)
  const af = asientosFondos(d)
  const fondosGasto = d.fondos.filter((f) => f.tipo === 'gasto' && !f.archivado)
  const idsGasto = new Set(fondosGasto.map((f) => f.id))
  const fijos = fijosDelMes(d, mes)
  // Solo los fijos que se pagan con un fondo de gasto: los demás no salen de lo que tienes para gastar.
  const fijosPendientes = sum(fijos.items.filter((x) => !x.pagado && x.r.fondoId && idsGasto.has(x.r.fondoId)).map((x) => x.r.monto))
  const diasRestantes = Math.max(1, diasDelMes(mes) - Number(hoy.slice(8, 10)) + 1)
  if (fondosGasto.length === 0) {
    const r = resumenMes(d, mes)
    const disponible = Math.max(0, r.disponible - fijosPendientes)
    return { enFondosDeGasto: 0, fijosPendientes, disponible, diasRestantes, porDia: disponible / diasRestantes, segunPresupuesto: true }
  }
  const enFondosDeGasto = r2(sum(fondosGasto.map((f) => saldoFondoEn(d, f, SIEMPRE, af))))
  const disponible = r2(enFondosDeGasto - fijosPendientes)
  return { enFondosDeGasto, fijosPendientes, disponible, diasRestantes, porDia: Math.max(0, disponible) / diasRestantes, segunPresupuesto: false }
}

/* ═════════════════════════ Metas ═════════════════════════ */

export type EstadoMeta = 'cumplida' | 'adelantada' | 'en camino' | 'atrasada' | 'sin fecha' | 'sin aportes'

export interface ProgresoMeta {
  fondo: Fondo
  objetivo: number
  actual: number
  falta: number
  pct: number
  /** Aporte neto promedio de los últimos 3 meses (lo que de verdad estás ahorrando en este fondo). */
  ritmo: number
  /** Aporte mensual planificado: % del ingreso esperado + aporte mensual fijo. */
  plan: number
  /** Cuánto aportar por mes para llegar a la fecha. */
  cuotaNecesaria: number | null
  mesesRestantes: number | null
  /** Fecha estimada (yyyy-mm) al ritmo actual (o al plan si aún no hay historia). */
  fechaEstimada: string | null
  estado: EstadoMeta
  aportadoEsteMes: number
  /** Lo que falta aportar este mes para ir al día. */
  faltaEsteMes: number
}

export function objetivoMeta(d: Datos, f: Fondo, mes = mesActual()): number {
  if (!f.meta) return 0
  if (f.meta.tipo === 'emergencia') return r2((f.meta.meses ?? 3) * gastoPromedioMensual(d, mes))
  return f.meta.objetivo
}

/** Aporte neto (entradas − salidas, sin contar el saldo inicial) a un fondo en un mes. */
export function aporteNetoMes(d: Datos, f: Fondo, mes: string, af = asientosFondos(d)): number {
  const base = baseFondo(d, f)
  return r2(sum(af.filter((a) => a.id === f.id && mesDe(a.fecha) === mes && a.fecha >= base).map((a) => a.monto)))
}

/** Meses para aportar desde `mes` (incluido) hasta la fecha de la meta (incluido su mes). */
export function mesesParaMeta(mes: string, fecha: string): number {
  return Math.max(1, mesesEntre(mes, mesDe(fecha)) + 1)
}

export function progresoMeta(d: Datos, f: Fondo, hoy = hoyISO()): ProgresoMeta {
  const mes = mesDe(hoy)
  const af = asientosFondos(d)
  const objetivo = objetivoMeta(d, f, mes)
  const actual = saldoFondoEn(d, f, SIEMPRE, af)
  const falta = Math.max(0, r2(objetivo - actual))
  const previos = mesesPrevios(mes, 3)
  const creada = f.meta?.creada ? mesDe(f.meta.creada) : null
  // Meses con datos: desde que hay asientos del fondo.
  const conDatos = previos.filter((m) => af.some((a) => a.id === f.id && mesDe(a.fecha) <= m) && (!creada || m >= mesMas(creada, -3)))
  const ritmo = conDatos.length ? r2(sum(conDatos.map((m) => aporteNetoMes(d, f, m, af))) / conDatos.length) : 0
  const plan = r2(ingresoEsperado(d, mes, true) * f.porcentaje + f.aporteMensual)
  // Con historia se usa el ritmo real (si estás retirando, no hay fecha estimada); sin historia, el plan.
  const velocidad = conDatos.length && ritmo !== 0 ? ritmo : plan
  const fecha = f.meta?.fecha ?? null
  const mesesRestantes = fecha ? mesesParaMeta(mes, fecha) : null
  const aportadoEsteMes = aporteNetoMes(d, f, mes, af)
  // La cuota del mes se calcula con lo que faltaba al empezar el mes, para que no cambie al aportar.
  const faltaInicioMes = Math.max(0, r2(objetivo - (actual - aportadoEsteMes)))
  const cuotaNecesaria = mesesRestantes ? r2(faltaInicioMes / mesesRestantes) : null
  const fechaEstimada = falta <= EPS ? mes : velocidad > 0 ? mesMas(mes, Math.ceil(falta / velocidad)) : null
  const objetivoMes = cuotaNecesaria ?? plan
  const faltaEsteMes = falta <= EPS ? 0 : Math.max(0, r2(Math.min(falta, objetivoMes - aportadoEsteMes)))

  let estado: EstadoMeta
  if (objetivo > 0 && actual >= objetivo - EPS) estado = 'cumplida'
  else if (velocidad <= 0) estado = fecha ? 'atrasada' : 'sin aportes'
  else if (!fecha || !mesesRestantes) estado = 'sin fecha'
  else {
    // Desde hoy quedan los meses restantes menos el actual si ya aportaste este mes.
    const alFinal = actual + velocidad * Math.max(0, mesesRestantes - (aportadoEsteMes > 0 ? 1 : 0))
    estado = alFinal >= objetivo * 1.1 ? 'adelantada' : alFinal >= objetivo - EPS ? 'en camino' : 'atrasada'
  }
  return { fondo: f, objetivo, actual, falta, pct: objetivo > 0 ? Math.min(1, Math.max(0, actual / objetivo)) : 0, ritmo, plan, cuotaNecesaria, mesesRestantes, fechaEstimada, estado, aportadoEsteMes, faltaEsteMes }
}

export function metas(d: Datos, hoy = hoyISO()): ProgresoMeta[] {
  return d.fondos.filter((f) => f.meta && !f.archivado).map((f) => progresoMeta(d, f, hoy))
}

/* ═════════════════════════ Patrimonio ═════════════════════════ */

export interface PuntoPatrimonio {
  mes: string
  total: number
  ahorro: number
  resto: number
}

/** Primer mes con información: la fecha de saldo más antigua o el primer registro. */
export function mesInicioDatos(d: Datos): string | null {
  const fechas = [...d.cuentas.map((c) => c.fechaSaldo), ...d.gastos.map((g) => g.fecha), ...d.movimientos.map((m) => m.fecha)].filter((f) => f && f > '1990')
  return fechas.length ? mesDe(fechas.sort()[0]) : null
}

/** Saldo total de las cuentas al cierre de cada mes (el mes en curso, a hoy). */
export function seriePatrimonio(d: Datos, mes: string, n: number, hoy = hoyISO()): PuntoPatrimonio[] {
  const ac = asientosCuentas(d)
  const af = asientosFondos(d)
  const ahorro = d.fondos.filter((f) => f.tipo === 'ahorro')
  return [...mesesPrevios(mes, n - 1), mes].map((m) => {
    const fecha = finDeMes(m) < hoy ? finDeMes(m) : hoy
    const total = r2(sum(d.cuentas.map((c) => saldoCuentaEn(d, c, fecha, ac))))
    const enAhorro = r2(sum(ahorro.map((f) => saldoFondoEn(d, f, fecha, af))))
    return { mes: m, total, ahorro: enAhorro, resto: r2(total - enAhorro) }
  })
}

/* ═════════════════════════ Serie mensual (tendencias) ═════════════════════════ */

export interface PuntoMensual {
  mes: string
  gasto: number
  ingreso: number
  ahorro: number
  tasaAhorro: number | null
  presupuesto: number
  /** Dinero que entró a fondos de ahorro (neto) en el mes. */
  apartado: number
  porCategoria: Record<string, number>
}

export function serieMensual(d: Datos, mes: string, n: number): PuntoMensual[] {
  const meses = [...mesesPrevios(mes, n - 1), mes]
  const presupuesto = presupuestoTotal(d)
  const af = asientosFondos(d)
  const ahorro = d.fondos.filter((f) => f.tipo === 'ahorro')
  return meses.map((m) => {
    const gasto = gastoMes(d, m)
    const ingreso = ingresoMes(d, m)
    const porCategoria: Record<string, number> = {}
    for (const c of d.categorias) porCategoria[c.id] = gastoMes(d, m, c.id)
    return {
      mes: m,
      gasto,
      ingreso,
      ahorro: ingreso - gasto,
      tasaAhorro: ingreso > 0 ? (ingreso - gasto) / ingreso : null,
      presupuesto,
      apartado: r2(sum(ahorro.map((f) => aporteNetoMes(d, f, m, af)))),
      porCategoria,
    }
  })
}

/* ═════════════════════════ Proyección por categoría ═════════════════════════ */

export interface FilaProyeccion {
  categoria: Categoria
  base: number
  meses: number[]
  total: number
  presupuestoN: number
  diferencia: number
}

export interface ProyeccionCategorias {
  meses: string[]
  filas: FilaProyeccion[]
  totalPorMes: number[]
  total: number
  presupuestoTotal: number
}

/** Gasto por categoría: base = promedio últimos 3 meses (o presupuesto si no hay historial) × (1+inflación)^k. */
export function proyeccionCategorias(d: Datos, mesBase: string, n = 6, inflacion = d.ajustes.inflacionMensual): ProyeccionCategorias {
  const meses = mesesDesde(mesBase, n)
  const filas: FilaProyeccion[] = d.categorias.map((c) => {
    const prom = promedio3Meses(d, mesBase, c.id)
    const base = prom > 0 ? prom : c.presupuesto
    const ms = meses.map((_, i) => base * Math.pow(1 + inflacion, i + 1))
    const total = sum(ms)
    return { categoria: c, base, meses: ms, total, presupuestoN: c.presupuesto * n, diferencia: c.presupuesto * n - total }
  })
  const totalPorMes = meses.map((_, i) => sum(filas.map((f) => f.meses[i])))
  return { meses, filas, totalPorMes, total: sum(totalPorMes), presupuestoTotal: presupuestoTotal(d) * n }
}

/* ═════════════════════════ Proyección de saldos (fondos, cuentas, metas) ═════════════════════════ */

export interface MesProyectado {
  mes: string
  ingreso: number
  gastoFijo: number
  gastoVariable: number
  compras: number
  /** Saldo proyectado de cada fondo al cierre del mes. */
  fondos: Record<string, number>
  sinAsignar: number
  total: number
  ahorro: number
}

export interface ResultadoProyeccion {
  meses: MesProyectado[]
  inicial: { fondos: Record<string, number>; sinAsignar: number; total: number; ahorro: number }
  /** Mes (yyyy-mm) en que cada meta llega a su objetivo dentro del horizonte, o null. */
  llegadaMetas: Record<string, string | null>
  /** Saldo proyectado de cada cuenta al cierre del horizonte (fondos que viven en ella). */
  porCuenta: Record<string, number>
}

const ESCENARIO_BASE: Escenario = { id: 'base', nombre: 'Base', ingresoPct: 0, recortePct: 0, aporteExtra: 0, aporteFondoId: null, compras: [] }

/**
 * Proyecta mes a mes desde el saldo actual:
 *  ingresos esperados (recurrentes o Ajustes) repartidos según cada fondo,
 *  gastos fijos (recurrentes) en su fondo, gasto variable = promedio de 3 meses sin fijos × inflación,
 *  aportes mensuales planificados a fondos, compras planeadas del escenario.
 */
export function proyectarSaldos(d: Datos, mesBase: string, n: number, escenario: Escenario = ESCENARIO_BASE, inflacion = d.ajustes.inflacionMensual): ResultadoProyeccion {
  const af = asientosFondos(d)
  const activos = d.fondos.filter((f) => !f.archivado)
  // Todos los fondos (también archivados) conservan su saldo; solo los activos reciben ingresos.
  const fondos: Record<string, number> = Object.fromEntries(d.fondos.map((f) => [f.id, saldoFondoEn(d, f, SIEMPRE, af)]))
  const totalCuentas = sum(saldosCuentas(d).map((c) => c.saldoActual))
  let sinAsignar = r2(totalCuentas - sum(Object.values(fondos)))
  const esAhorro = (id: string) => activos.find((f) => f.id === id)?.tipo === 'ahorro'
  const totalAhorro = () => sum(Object.entries(fondos).filter(([id]) => esAhorro(id)).map(([, v]) => v))
  const inicial = { fondos: { ...fondos }, sinAsignar, total: r2(totalCuentas), ahorro: r2(totalAhorro()) }

  // Gasto variable base por fondo: promedio de los últimos 3 meses, sin gastos de recurrentes.
  const previos = mesesPrevios(mesBase, 3)
  // Gastos fijos anotados a mano (misma descripción que un fijo) no cuentan como variables: ya se proyectan como fijos.
  const nombresFijos = new Set(d.recurrentes.filter((r) => r.activo && r.tipo === 'gasto').map((r) => r.nombre.trim().toLowerCase()))
  const variables = d.gastos.filter((g) => !g.recurrenteId && !nombresFijos.has(g.descripcion.trim().toLowerCase()) && previos.includes(mesDe(g.fecha)))
  const fijosMensuales = sum(d.recurrentes.filter((r) => r.activo && r.tipo === 'gasto' && r.frecuencia === 'mensual').map((r) => r.monto))
  // Promedio sobre los meses que tienen gastos (1 a 3), no siempre sobre 3.
  const mesesConDatos = Math.max(1, new Set(d.gastos.filter((g) => previos.includes(mesDe(g.fecha))).map((g) => mesDe(g.fecha))).size)
  let baseVariable: Record<string, number> = {}
  const totalVar = sum(variables.map((g) => g.monto)) / mesesConDatos
  if (totalVar > 0) {
    for (const g of variables) {
      const k = g.fondoId && fondos[g.fondoId] !== undefined ? g.fondoId : ''
      baseVariable[k] = (baseVariable[k] ?? 0) + g.monto / mesesConDatos
    }
  } else {
    const estimado = Math.max(0, presupuestoTotal(d) - fijosMensuales)
    const deGasto = activos.filter((f) => f.tipo === 'gasto')
    const pctGasto = sum(deGasto.map((f) => f.porcentaje))
    if (estimado > 0 && deGasto.length) {
      baseVariable = Object.fromEntries(deGasto.map((f) => [f.id, pctGasto > 0 ? (estimado * f.porcentaje) / pctGasto : estimado / deGasto.length]))
    } else if (estimado > 0) baseVariable = { '': estimado }
  }

  const reparto = (monto: number, distribuir: boolean, fondoId: string | null) => {
    const out: Record<string, number> = {}
    if (!distribuir) {
      if (fondoId && fondos[fondoId] !== undefined) out[fondoId] = monto
      return out
    }
    for (const f of activos) if (f.porcentaje > 0) out[f.id] = monto * f.porcentaje
    return out
  }
  const aplicar = (id: string | null, v: number) => {
    if (id && fondos[id] !== undefined) fondos[id] += v
    else sinAsignar += v
  }

  // Movimientos entre fondos que se repiten (recargar efectivo, aportes desde un fondo de gasto):
  // promedio de los últimos 3 meses. Solo de fondo a fondo; lo que sale de "sin asignar" no se repite.
  const flujos: Record<string, number> = {}
  for (const m of d.movimientos) {
    if (m.tipo !== 'transferencia' || !previos.includes(mesDe(m.fecha))) continue
    const o = m.fondoOrigenId && fondos[m.fondoOrigenId] !== undefined ? m.fondoOrigenId : null
    const de = m.fondoDestinoId && fondos[m.fondoDestinoId] !== undefined ? m.fondoDestinoId : null
    if (!o || !de || o === de) continue
    flujos[o] = (flujos[o] ?? 0) - m.monto / mesesConDatos
    flujos[de] = (flujos[de] ?? 0) + m.monto / mesesConDatos
  }

  const recIngreso = d.recurrentes.filter((r) => r.activo && r.tipo === 'ingreso')
  const recGasto = d.recurrentes.filter((r) => r.activo && r.tipo === 'gasto')
  // Lo que falta del mes en curso: ingresos y fijos aún sin registrar.
  for (const r of d.recurrentes) {
    if (!r.activo || !fechaOcurrencia(r, mesBase) || r.omitidos?.includes(mesBase) || estaRegistrado(d, r, mesBase)) continue
    if (r.tipo === 'gasto') aplicar(r.fondoId, -r.monto)
    else {
      const rep = reparto(r.monto, r.distribuir !== false, r.fondoId)
      for (const [id, v] of Object.entries(rep)) aplicar(id, v)
      aplicar(null, r.monto - sum(Object.values(rep)))
    }
  }

  const meses: MesProyectado[] = []
  const llegadaMetas: Record<string, string | null> = Object.fromEntries(activos.filter((f) => f.meta).map((f) => [f.id, null]))
  const objetivos = Object.fromEntries(activos.filter((f) => f.meta).map((f) => [f.id, objetivoMeta(d, f, mesBase)]))
  for (const [id, obj] of Object.entries(objetivos)) if (obj > 0 && fondos[id] >= obj - EPS) llegadaMetas[id] = mesBase

  mesesDesde(mesBase, n).forEach((mes, i) => {
    const factorIng = 1 + escenario.ingresoPct
    let ingreso = 0
    if (recIngreso.length) {
      for (const r of recIngreso) {
        if (!fechaOcurrencia(r, mes)) continue
        const monto = r.monto * factorIng
        ingreso += monto
        const rep = reparto(monto, r.distribuir !== false, r.fondoId)
        const asignado = sum(Object.values(rep))
        for (const [id, v] of Object.entries(rep)) aplicar(id, v)
        aplicar(null, monto - asignado)
      }
    } else {
      const monto = d.ajustes.ingresoMensual * factorIng
      ingreso = monto
      const rep = reparto(monto, true, null)
      for (const [id, v] of Object.entries(rep)) aplicar(id, v)
      aplicar(null, monto - sum(Object.values(rep)))
    }

    let gastoFijo = 0
    for (const r of recGasto) {
      if (!fechaOcurrencia(r, mes)) continue
      gastoFijo += r.monto
      aplicar(r.fondoId, -r.monto)
    }

    for (const [id, v] of Object.entries(flujos)) aplicar(id, v)

    // Gasto variable. Un ahorro extra del escenario significa gastar menos y apartar esa diferencia.
    const factor = Math.pow(1 + inflacion, i + 1) * (1 - escenario.recortePct)
    const V = sum(Object.values(baseVariable)) * factor
    const X = Math.max(0, escenario.aporteExtra)
    const reduccion = Math.min(X, V)
    const escala = V > 0 ? (V - reduccion) / V : 1
    let gastoVariable = 0
    for (const [id, v] of Object.entries(baseVariable)) {
      const g = v * factor * escala
      gastoVariable += g
      aplicar(id || null, -g)
    }
    if (X > 0) {
      aplicar(escenario.aporteFondoId, X)
      for (const [id, v] of Object.entries(baseVariable)) aplicar(id || null, V > 0 ? -((v * factor) / V) * reduccion : 0)
      aplicar(null, -(X - reduccion))
    }

    // Aportes planificados: salen de "sin asignar" hacia el fondo.
    for (const f of activos) {
      if (f.aporteMensual > 0) {
        aplicar(f.id, f.aporteMensual)
        aplicar(null, -f.aporteMensual)
      }
    }

    let compras = 0
    for (const c of escenario.compras) {
      if (c.mes !== mes) continue
      compras += c.monto
      aplicar(c.fondoId, -c.monto)
    }

    for (const [id, obj] of Object.entries(objetivos)) {
      if (llegadaMetas[id] === null && obj > 0 && fondos[id] >= obj - EPS) llegadaMetas[id] = mes
    }
    const total = sum(Object.values(fondos)) + sinAsignar
    meses.push({
      mes,
      ingreso: r2(ingreso),
      gastoFijo: r2(gastoFijo),
      gastoVariable: r2(gastoVariable),
      compras: r2(compras),
      fondos: Object.fromEntries(Object.entries(fondos).map(([k, v]) => [k, r2(v)])),
      sinAsignar: r2(sinAsignar),
      total: r2(total),
      ahorro: r2(totalAhorro()),
    })
  })

  const porCuenta: Record<string, number> = {}
  for (const f of activos) if (f.cuentaId) porCuenta[f.cuentaId] = r2((porCuenta[f.cuentaId] ?? 0) + (fondos[f.id] ?? 0))
  return { meses, inicial, llegadaMetas, porCuenta }
}

/* ═════════════════════════ Ritmo diario ═════════════════════════ */

export function acumuladoDiario(d: Pick<Datos, 'gastos' | 'categorias'>, mes: string): { dia: number; acumulado: number | null; ritmo: number }[] {
  const { diasMes, transcurridos } = diasTranscurridos(mes)
  const presupuesto = presupuestoTotal(d)
  const porDia = new Array<number>(diasMes + 1).fill(0)
  for (const g of d.gastos) {
    if (mesDe(g.fecha) !== mes) continue
    porDia[parseInt(g.fecha.slice(8, 10), 10)] += g.monto
  }
  let acc = 0
  return Array.from({ length: diasMes }, (_, i) => {
    const dia = i + 1
    acc += porDia[dia]
    return { dia, acumulado: dia <= transcurridos ? acc : null, ritmo: (presupuesto / diasMes) * dia }
  })
}

/* ═════════════════════════ Impacto de un gasto ═════════════════════════ */

export interface ImpactoGasto {
  presupuestoCategoria: number
  disponibleCategoriaDespues: number
  saldoCuenta: number
  saldoCuentaDespues: number
  saldoFondo: number
  saldoFondoDespues: number
}

/** Vista previa del impacto de un gasto antes de guardarlo. */
export function impactoGasto(d: Datos, g: { fecha: string; categoriaId: string; monto: number; cuentaId: string | null; fondoId: string | null }): ImpactoGasto {
  const mes = mesDe(g.fecha || `${mesActual()}-01`)
  const cat = d.categorias.find((c) => c.id === g.categoriaId)
  const presupuestoCategoria = cat?.presupuesto ?? 0
  const gastadoCat = cat ? gastoMes(d, mes, cat.id) : 0
  const saldoCuenta = saldosCuentas(d).find((s) => s.cuenta.id === g.cuentaId)?.saldoActual ?? 0
  const fondo = d.fondos.find((f) => f.id === g.fondoId)
  const saldoFondo = fondo ? saldoFondoEn(d, fondo, SIEMPRE) : 0
  return {
    presupuestoCategoria,
    disponibleCategoriaDespues: presupuestoCategoria - gastadoCat - g.monto,
    saldoCuenta,
    saldoCuentaDespues: saldoCuenta - (g.cuentaId ? g.monto : 0),
    saldoFondo,
    saldoFondoDespues: saldoFondo - (g.fondoId ? g.monto : 0),
  }
}

/* ═════════════════════════ Cierre de mes ═════════════════════════ */

export interface CierreMes {
  mes: string
  ingreso: number
  gasto: number
  ahorroNeto: number
  tasaAhorro: number | null
  apartado: number
  patrimonioInicio: number
  patrimonioFin: number
  variacionPatrimonio: number
  gastoVsPromedio: number | null
  excedidas: FilaCategoria[]
  topGastos: Gasto[]
  metas: { fondo: Fondo; antes: number; despues: number; aporte: number; objetivo: number }[]
  fijos: { total: number; pendiente: number }
}

export function cierreMes(d: Datos, mes: string, hoy = hoyISO()): CierreMes {
  const r = resumenMes(d, mes)
  const ac = asientosCuentas(d)
  const af = asientosFondos(d)
  const diaAntes = format(new Date(parseISO(`${mes}-01`).getTime() - 864e5), 'yyyy-MM-dd')
  const fin = finDeMes(mes) < hoy ? finDeMes(mes) : hoy
  const patrimonioInicio = r2(sum(d.cuentas.map((c) => saldoCuentaEn(d, c, diaAntes, ac))))
  const patrimonioFin = r2(sum(d.cuentas.map((c) => saldoCuentaEn(d, c, fin, ac))))
  const prom = promedio3Meses(d, mes)
  const ahorro = d.fondos.filter((f) => f.tipo === 'ahorro')
  const ingreso = r.ingresoRegistrado
  return {
    mes,
    ingreso,
    gasto: r.gasto,
    ahorroNeto: r2(ingreso - r.gasto),
    tasaAhorro: ingreso > 0 ? (ingreso - r.gasto) / ingreso : null,
    apartado: r2(sum(ahorro.map((f) => aporteNetoMes(d, f, mes, af)))),
    patrimonioInicio,
    patrimonioFin,
    variacionPatrimonio: r2(patrimonioFin - patrimonioInicio),
    gastoVsPromedio: prom > 0 ? r.gasto / prom - 1 : null,
    excedidas: r.categorias.filter((c) => c.estado === 'Excedido'),
    topGastos: d.gastos.filter((g) => mesDe(g.fecha) === mes).sort((a, b) => b.monto - a.monto).slice(0, 5),
    metas: d.fondos
      .filter((f) => f.meta)
      .map((f) => ({ fondo: f, antes: saldoFondoEn(d, f, diaAntes, af), despues: saldoFondoEn(d, f, fin, af), aporte: aporteNetoMes(d, f, mes, af), objetivo: objetivoMeta(d, f, mes) })),
    fijos: (() => {
      const x = fijosDelMes(d, mes)
      return { total: x.total, pendiente: x.pendiente }
    })(),
  }
}

/* ═════════════════════════ Alertas ═════════════════════════ */

export type TonoAlerta = 'bad' | 'warn' | 'info'
export type DestinoAlerta = 'inicio' | 'movimientos' | 'metas' | 'cuentas' | 'plan' | 'analisis' | 'ajustes'

export interface Alerta {
  id: string
  tono: TonoAlerta
  titulo: string
  detalle?: string
  destino?: DestinoAlerta
}

export function alertas(d: Datos, hoy = hoyISO()): Alerta[] {
  const mes = mesDe(hoy)
  const out: Alerta[] = []
  const f = resumenFondos(d, mes)
  const fmt = (n: number) => `${d.ajustes.moneda} ${Math.abs(n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (f.sinAsignar < -1) out.push({ id: 'sin-asignar-neg', tono: 'bad', titulo: `Tus fondos suman ${fmt(f.sinAsignar)} más que tus cuentas`, detalle: 'Revisa los saldos iniciales de los fondos o ajusta tus cuentas al saldo del banco.', destino: 'cuentas' })
  for (const x of f.filas) if (x.saldo < -EPS) out.push({ id: `fondo-neg-${x.fondo.id}`, tono: 'bad', titulo: `El fondo ${x.fondo.nombre} está en ${fmt(x.saldo)} negativo`, detalle: 'Gastaste más de lo que tenía. Mueve dinero desde otro fondo para cubrirlo.', destino: 'cuentas' })

  for (const p of ocurrenciasPendientes(d, hoy).filter((o) => o.vencida)) {
    out.push({ id: `rec-${p.recurrente.id}-${p.mes}`, tono: 'warn', titulo: `${p.recurrente.nombre}: ${p.recurrente.tipo === 'gasto' ? 'pago' : 'cobro'} del ${Number(p.fecha.slice(8, 10))} sin registrar`, detalle: fmt(p.recurrente.monto), destino: 'plan' })
  }

  const r = resumenMes(d, mes)
  for (const c of r.categorias) {
    if (c.presupuesto <= 0) continue
    const p = c.gastado / c.presupuesto
    if (p > 1 + 1e-9) out.push({ id: `cat-${c.categoria.id}`, tono: 'bad', titulo: `${c.categoria.nombre} se pasó del presupuesto`, detalle: `Llevas ${fmt(c.gastado)} de ${fmt(c.presupuesto)}.`, destino: 'plan' })
    else if (p >= 0.8) out.push({ id: `cat-${c.categoria.id}`, tono: 'warn', titulo: `${c.categoria.nombre} va en ${Math.round(p * 100)}% del presupuesto`, detalle: `Quedan ${fmt(c.disponible)} para el resto del mes.`, destino: 'plan' })
  }

  for (const m of metas(d, hoy)) {
    if (m.estado === 'atrasada') out.push({ id: `meta-${m.fondo.id}`, tono: 'warn', titulo: `Meta ${m.fondo.nombre} atrasada`, detalle: `Necesitas aportar ${fmt(m.cuotaNecesaria ?? 0)} al mes; vas a ${fmt(m.ritmo || m.plan)}.`, destino: 'metas' })
    if (m.estado === 'cumplida') out.push({ id: `meta-ok-${m.fondo.id}`, tono: 'info', titulo: `Cumpliste la meta ${m.fondo.nombre}`, detalle: `Tienes ${fmt(m.actual)} de ${fmt(m.objetivo)}.`, destino: 'metas' })
  }

  const cuadre = cuadreCuentas(saldosCuentas(d))
  for (const t of cuadre) out.push({ id: `cuadre-${t.origen.id}-${t.destino.id}`, tono: 'info', titulo: `Mueve ${fmt(t.monto)} de ${t.origen.nombre} a ${t.destino.nombre}`, detalle: 'Así cada cuenta tiene el dinero de los fondos que guarda.', destino: 'cuentas' })

  if (f.sinAsignar > 1 && d.fondos.length) out.push({ id: 'sin-asignar', tono: 'info', titulo: `Tienes ${fmt(f.sinAsignar)} sin asignar`, detalle: 'Repártelos entre tus fondos o metas para saber para qué es cada boliviano.', destino: 'cuentas' })
  if (Math.abs(f.totalPct - 1) > 0.001 && d.fondos.length) out.push({ id: 'pct', tono: 'info', titulo: `El reparto del ingreso suma ${Math.round(f.totalPct * 1000) / 10}%`, detalle: f.totalPct < 1 ? 'Lo que no se reparte queda sin asignar.' : 'Repartes más de lo que entra: ajústalo a 100%.', destino: 'ajustes' })
  if (r.ingresoRegistrado <= 0 && Number(hoy.slice(8, 10)) > 5 && d.movimientos.length > 0) out.push({ id: 'sin-ingreso', tono: 'info', titulo: 'Aún no registraste ingresos este mes', detalle: 'Mientras tanto se usa el ingreso esperado para los cálculos.', destino: 'movimientos' })

  const orden: Record<TonoAlerta, number> = { bad: 0, warn: 1, info: 2 }
  return out.sort((a, b) => orden[a.tono] - orden[b.tono])
}

