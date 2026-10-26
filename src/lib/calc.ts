import { addMonths, differenceInCalendarDays, format, getDaysInMonth, isAfter, isBefore, parseISO, startOfMonth } from 'date-fns'
import type { Categoria, Cuenta, Datos, Estado, Fondo } from '../types'
import { mesActual, mesDe } from './format'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function mesMas(mes: string, n: number): string {
  return format(addMonths(parseISO(`${mes}-01`), n), 'yyyy-MM')
}

export function mesesPrevios(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => mesMas(mes, -(n - i)))
}

export function mesesDesde(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => mesMas(mes, i + 1))
}

/** Ingreso registrado en un mes (solo movimientos tipo ingreso). */
export function ingresoMes(d: Datos, mes: string): number {
  return sum(d.movimientos.filter((m) => m.tipo === 'ingreso' && mesDe(m.fecha) === mes).map((m) => m.monto))
}

/** Ingreso a usar para análisis: el registrado, o el configurado si no hay registros en ese mes. */
export function ingresoEfectivo(d: Datos, mes: string): number {
  const r = ingresoMes(d, mes)
  return r > 0 ? r : d.ajustes.ingresoMensual
}

export function gastoMes(d: Datos, mes: string, categoriaId?: string): number {
  return sum(
    d.gastos
      .filter((g) => mesDe(g.fecha) === mes && (categoriaId === undefined || g.categoriaId === categoriaId))
      .map((g) => g.monto),
  )
}

export function presupuestoTotal(d: Datos): number {
  return sum(d.categorias.map((c) => c.presupuesto))
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
  ahorroProyectado: number
  tasaAhorroProyectada: number | null
  ahorroReal: number
  tasaAhorroReal: number | null
  categoriaMayor: Categoria | null
  estado: Estado
  categorias: FilaCategoria[]
  saldoTotalCuentas: number
}

function diasTranscurridos(mes: string): { diasMes: number; transcurridos: number } {
  const inicio = parseISO(`${mes}-01`)
  const diasMes = getDaysInMonth(inicio)
  const hoy = new Date()
  if (isBefore(hoy, inicio)) return { diasMes, transcurridos: 0 }
  if (isAfter(hoy, addMonths(inicio, 1))) return { diasMes, transcurridos: diasMes }
  return { diasMes, transcurridos: Math.min(diasMes, differenceInCalendarDays(hoy, inicio) + 1) }
}

export function promedio3Meses(d: Datos, mes: string, categoriaId: string): number {
  const prev = mesesPrevios(mes, 3)
  return sum(prev.map((m) => gastoMes(d, m, categoriaId))) / 3
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
    const prom3m = promedio3Meses(d, mes, c.id)
    const estado: Estado = gastado > c.presupuesto ? 'Excedido' : proyeccion > c.presupuesto ? 'En riesgo' : 'En control'
    return {
      categoria: c,
      presupuesto: c.presupuesto,
      gastado,
      disponible: c.presupuesto - gastado,
      pctUsado: c.presupuesto > 0 ? gastado / c.presupuesto : null,
      proyeccion,
      prom3m,
      estado,
    }
  })

  const mayor = categorias.reduce<FilaCategoria | null>((a, b) => (b.gastado > 0 && (!a || b.gastado > a.gastado) ? b : a), null)

  const estado: Estado =
    gasto > presupuesto ? 'Excedido' : proyeccionCierre > presupuesto ? 'En riesgo' : 'En control'

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
    ahorroProyectado,
    tasaAhorroProyectada: ingreso > 0 ? ahorroProyectado / ingreso : null,
    ahorroReal,
    tasaAhorroReal: ingreso > 0 ? ahorroReal / ingreso : null,
    categoriaMayor: mayor?.categoria ?? null,
    estado,
    categorias,
    saldoTotalCuentas: sum(saldosCuentas(d).map((c) => c.saldoActual)),
  }
}

export interface SaldoCuenta {
  cuenta: Cuenta
  saldoInicial: number
  ingresos: number
  gastos: number
  transfRecibidas: number
  transfEnviadas: number
  saldoActual: number
  fondos: Fondo[]
}

export function saldosCuentas(d: Datos): SaldoCuenta[] {
  return d.cuentas.map((c) => {
    const desde = c.fechaSaldo
    const ingresos = sum(
      d.movimientos.filter((m) => m.tipo === 'ingreso' && m.cuentaDestinoId === c.id && m.fecha >= desde).map((m) => m.monto),
    )
    const gastos = sum(d.gastos.filter((g) => g.cuentaId === c.id && g.fecha >= desde).map((g) => g.monto))
    const transfRecibidas = sum(
      d.movimientos
        .filter((m) => m.tipo === 'transferencia' && m.cuentaDestinoId === c.id && m.fecha >= desde)
        .map((m) => m.monto),
    )
    const transfEnviadas = sum(
      d.movimientos
        .filter((m) => m.tipo === 'transferencia' && m.cuentaOrigenId === c.id && m.fecha >= desde)
        .map((m) => m.monto),
    )
    return {
      cuenta: c,
      saldoInicial: c.saldoInicial,
      ingresos,
      gastos,
      transfRecibidas,
      transfEnviadas,
      saldoActual: c.saldoInicial + ingresos - gastos + transfRecibidas - transfEnviadas,
      fondos: d.fondos.filter((f) => f.cuentaId === c.id),
    }
  })
}

export interface FilaFondo {
  fondo: Fondo
  asignado: number
  usado: number
  pctUsado: number | null
  saldoMes: number
  estado: Estado
  saldoAcumulado: number
  cuenta: Cuenta | null
  saldoCuenta: number
}

export interface ResumenFondos {
  filas: FilaFondo[]
  totalPct: number
  ingresoMes: number
  saldoNetoMes: number
  saldoNetoAcumulado: number
  emergenciasAcumulado: number
}

export function resumenFondos(d: Datos, mes: string): ResumenFondos {
  const ingreso = ingresoMes(d, mes)
  const ingresoTotal = sum(d.movimientos.filter((m) => m.tipo === 'ingreso').map((m) => m.monto))
  const saldos = saldosCuentas(d)
  const filas: FilaFondo[] = d.fondos.map((f) => {
    const asignado = ingreso * f.porcentaje
    const usado = sum(d.gastos.filter((g) => g.fondoId === f.id && mesDe(g.fecha) === mes).map((g) => g.monto))
    const usadoTotal = sum(d.gastos.filter((g) => g.fondoId === f.id).map((g) => g.monto))
    const saldoMes = asignado - usado
    const pctUsado = asignado > 0 ? usado / asignado : null
    const estado: Estado = saldoMes < 0 ? 'Excedido' : asignado > 0 && (pctUsado ?? 0) > 0.85 ? 'En riesgo' : 'En control'
    const cuenta = d.cuentas.find((c) => c.id === f.cuentaId) ?? null
    return {
      fondo: f,
      asignado,
      usado,
      pctUsado,
      saldoMes,
      estado,
      saldoAcumulado: ingresoTotal * f.porcentaje - usadoTotal,
      cuenta,
      saldoCuenta: saldos.find((s) => s.cuenta.id === f.cuentaId)?.saldoActual ?? 0,
    }
  })
  const neto = filas.filter((f) => f.fondo.enSaldoNeto)
  return {
    filas,
    totalPct: sum(d.fondos.map((f) => f.porcentaje)),
    ingresoMes: ingreso,
    saldoNetoMes: sum(neto.map((f) => f.saldoMes)),
    saldoNetoAcumulado: sum(neto.map((f) => f.saldoAcumulado)),
    emergenciasAcumulado: sum(filas.filter((f) => /emergencia/i.test(f.fondo.nombre)).map((f) => f.saldoAcumulado)),
  }
}

export interface FilaDistribucionCuenta {
  cuenta: Cuenta
  fondos: Fondo[]
  debeRecibir: number
  recibioNeto: number
  pendiente: number
  saldoActual: number
}

/** ¿Cuánto debe recibir cada cuenta este mes según la distribución del ingreso? */
export function distribucionCuentas(d: Datos, mes: string): FilaDistribucionCuenta[] {
  const ingreso = ingresoMes(d, mes)
  const saldos = saldosCuentas(d)
  return d.cuentas.map((c) => {
    const fondos = d.fondos.filter((f) => f.cuentaId === c.id)
    const debeRecibir = sum(fondos.map((f) => ingreso * f.porcentaje))
    const movsMes = d.movimientos.filter((m) => mesDe(m.fecha) === mes)
    const recibioNeto =
      sum(movsMes.filter((m) => m.cuentaDestinoId === c.id).map((m) => m.monto)) -
      sum(movsMes.filter((m) => m.tipo === 'transferencia' && m.cuentaOrigenId === c.id).map((m) => m.monto))
    return {
      cuenta: c,
      fondos,
      debeRecibir,
      recibioNeto,
      pendiente: debeRecibir - recibioNeto,
      saldoActual: saldos.find((s) => s.cuenta.id === c.id)?.saldoActual ?? 0,
    }
  })
}

export interface PuntoMensual {
  mes: string
  gasto: number
  ingreso: number
  ahorro: number
  tasaAhorro: number | null
  presupuesto: number
  porCategoria: Record<string, number>
}

/** Serie de los últimos n meses terminando en `mes` (inclusive). */
export function serieMensual(d: Datos, mes: string, n: number): PuntoMensual[] {
  const meses = [...mesesPrevios(mes, n - 1), mes]
  const presupuesto = presupuestoTotal(d)
  return meses.map((m) => {
    const gasto = gastoMes(d, m)
    const registrado = ingresoMes(d, m)
    // Meses sin ningún registro no inventan ingreso; con gastos y sin ingreso registrado se usa el configurado.
    const ingreso = registrado > 0 ? registrado : gasto > 0 ? d.ajustes.ingresoMensual : 0
    const porCategoria: Record<string, number> = {}
    for (const c of d.categorias) porCategoria[c.id] = gastoMes(d, m, c.id)
    return {
      mes: m,
      gasto,
      ingreso,
      ahorro: ingreso - gasto,
      tasaAhorro: ingreso > 0 ? (ingreso - gasto) / ingreso : null,
      presupuesto,
      porCategoria,
    }
  })
}

export interface FilaProyeccion {
  categoria: Categoria
  base: number
  meses: number[]
  total: number
  presupuesto6: number
  diferencia: number
}

export interface Proyeccion {
  meses: string[]
  filas: FilaProyeccion[]
  totalPorMes: number[]
  ingresoPorMes: number[]
  ahorroPorMes: number[]
  tasaPorMes: (number | null)[]
  total: number
  presupuestoTotal: number
}

/** Proyección a n meses: base = promedio últimos 3 meses (o presupuesto si no hay historial) × (1+inflación)^k. */
export function proyeccion(d: Datos, mesBase: string, n = 6, inflacion = d.ajustes.inflacionMensual): Proyeccion {
  const meses = mesesDesde(mesBase, n)
  const ingreso = ingresoEfectivo(d, mesBase)
  const filas: FilaProyeccion[] = d.categorias.map((c) => {
    const prom = promedio3Meses(d, mesBase, c.id)
    const base = prom > 0 ? prom : c.presupuesto
    const ms = meses.map((_, i) => base * Math.pow(1 + inflacion, i + 1))
    const total = sum(ms)
    return { categoria: c, base, meses: ms, total, presupuesto6: c.presupuesto * n, diferencia: c.presupuesto * n - total }
  })
  const totalPorMes = meses.map((_, i) => sum(filas.map((f) => f.meses[i])))
  const ingresoPorMes = meses.map(() => ingreso)
  const ahorroPorMes = totalPorMes.map((t) => ingreso - t)
  return {
    meses,
    filas,
    totalPorMes,
    ingresoPorMes,
    ahorroPorMes,
    tasaPorMes: ahorroPorMes.map((a) => (ingreso > 0 ? a / ingreso : null)),
    total: sum(totalPorMes),
    presupuestoTotal: presupuestoTotal(d) * n,
  }
}

/** Gasto acumulado día a día del mes vs. ritmo lineal del presupuesto. */
export function acumuladoDiario(d: Datos, mes: string): { dia: number; acumulado: number | null; ritmo: number }[] {
  const { diasMes, transcurridos } = diasTranscurridos(mes)
  const presupuesto = presupuestoTotal(d)
  const porDia = new Array<number>(diasMes + 1).fill(0)
  for (const g of d.gastos) {
    if (mesDe(g.fecha) !== mes) continue
    const dia = parseInt(g.fecha.slice(8, 10), 10)
    porDia[dia] += g.monto
  }
  let acc = 0
  return Array.from({ length: diasMes }, (_, i) => {
    const dia = i + 1
    acc += porDia[dia]
    return { dia, acumulado: dia <= transcurridos ? acc : null, ritmo: (presupuesto / diasMes) * dia }
  })
}

export interface ImpactoGasto {
  presupuestoCategoria: number
  disponibleCategoriaDespues: number
  saldoCuenta: number
  saldoCuentaDespues: number
  saldoFondoMes: number
  saldoFondoDespues: number
  saldoNetoDespues: number
}

/** Vista previa del impacto de un gasto antes de guardarlo (como la hoja "Carga"). */
export function impactoGasto(
  d: Datos,
  g: { fecha: string; categoriaId: string; monto: number; cuentaId: string | null; fondoId: string | null },
): ImpactoGasto {
  const mes = mesDe(g.fecha || `${mesActual()}-01`)
  const cat = d.categorias.find((c) => c.id === g.categoriaId)
  const presupuestoCategoria = cat?.presupuesto ?? 0
  const gastadoCat = cat ? gastoMes(d, mes, cat.id) : 0
  const saldos = saldosCuentas(d)
  const saldoCuenta = saldos.find((s) => s.cuenta.id === g.cuentaId)?.saldoActual ?? 0
  const fondos = resumenFondos(d, mes)
  const fila = fondos.filas.find((f) => f.fondo.id === g.fondoId)
  const saldoFondoMes = fila?.saldoMes ?? 0
  const afectaNeto = fila?.fondo.enSaldoNeto ?? false
  return {
    presupuestoCategoria,
    disponibleCategoriaDespues: presupuestoCategoria - gastadoCat - g.monto,
    saldoCuenta,
    saldoCuentaDespues: saldoCuenta - (g.cuentaId ? g.monto : 0),
    saldoFondoMes,
    saldoFondoDespues: saldoFondoMes - (g.fondoId ? g.monto : 0),
    saldoNetoDespues: fondos.saldoNetoMes - (afectaNeto ? g.monto : 0),
  }
}

export function inicioMes(mes: string): Date {
  return startOfMonth(parseISO(`${mes}-01`))
}
