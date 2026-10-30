/**
 * Normalización y migración de datos guardados.
 * v1 (rediseño anterior): fondos sin tipo ni saldo inicial, el ahorro se registraba como gasto en una categoría "Ahorro".
 * v2: fondos con saldo arrastrado, metas, ingresos que se distribuyen u omiten, transferencias entre fondos,
 *     ajustes de saldo, recurrentes y escenarios.
 */
import type { Categoria, Cuenta, Datos, Fondo, Gasto, Meta, MetodoPago, Movimiento, Recurrente, Escenario, TipoFondo } from '../types'
import { hoyISO, uid } from './format'
import { fondoNuevo } from './seed'

export const VERSION_DATOS = 2

const RE_FONDO_AHORRO = /ahorr|emergencia|meta|inversi|reserva|colch[oó]n/i
const RE_CATEGORIA_AHORRO = /^\s*ahorr/i

type Crudo = Record<string, unknown>
/** Lista de objetos válidos: descarta entradas nulas o que no son objetos. */
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as T[]) : [])
const numero = (v: unknown, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : def)
const texto = (v: unknown, def = '') => (typeof v === 'string' ? v : def)

export function tipoFondoPorNombre(nombre: string): TipoFondo {
  return RE_FONDO_AHORRO.test(nombre) ? 'ahorro' : 'gasto'
}

function normalizarMeta(m: unknown): Meta | null {
  if (!m || typeof m !== 'object') return null
  const x = m as Crudo
  const tipo = x.tipo === 'emergencia' ? 'emergencia' : 'monto'
  return {
    tipo,
    objetivo: numero(x.objetivo),
    meses: tipo === 'emergencia' ? Math.max(1, numero(x.meses, 3)) : undefined,
    fecha: typeof x.fecha === 'string' && x.fecha ? x.fecha : null,
    creada: texto(x.creada, hoyISO()),
  }
}

function normalizarFondo(f: Crudo, fechaCuenta: (id: string | null) => string | null): Fondo {
  const nombre = texto(f.nombre, 'Fondo')
  const tipo: TipoFondo = f.tipo === 'ahorro' || f.tipo === 'gasto' ? f.tipo : tipoFondoPorNombre(nombre)
  let meta = normalizarMeta(f.meta)
  // Un fondo de emergencias sin meta recibe una sugerida (3 meses de gasto) que el usuario puede cambiar.
  if (!meta && f.meta === undefined && /emergencia/i.test(nombre)) meta = { tipo: 'emergencia', objetivo: 0, meses: 3, fecha: null, creada: hoyISO() }
  return fondoNuevo({
    id: texto(f.id) || uid(),
    nombre,
    porcentaje: numero(f.porcentaje),
    cuentaId: (f.cuentaId as string | null) ?? null,
    enSaldoNeto: f.enSaldoNeto === undefined ? true : Boolean(f.enSaldoNeto),
    icono: typeof f.icono === 'string' ? f.icono : undefined,
    tipo,
    saldoInicial: numero(f.saldoInicial),
    // Antes la fecha del saldo del fondo era la de su cuenta: se fija al cargar para que no cambie si el fondo se mueve.
    fechaSaldo: texto(f.fechaSaldo) || fechaCuenta((f.cuentaId as string | null) ?? null) || '0000-01-01',
    aporteMensual: numero(f.aporteMensual),
    meta,
    color: typeof f.color === 'string' ? f.color : undefined,
    archivado: Boolean(f.archivado),
  })
}

function normalizarMovimiento(m: Crudo): Movimiento {
  const tipo = m.tipo === 'transferencia' || m.tipo === 'ajuste' ? m.tipo : 'ingreso'
  const mov: Movimiento = {
    id: texto(m.id) || uid(),
    fecha: texto(m.fecha),
    tipo,
    descripcion: texto(m.descripcion),
    cuentaOrigenId: (m.cuentaOrigenId as string | null) ?? null,
    cuentaDestinoId: (m.cuentaDestinoId as string | null) ?? null,
    monto: numero(m.monto),
    fondoOrigenId: (m.fondoOrigenId as string | null) ?? null,
    fondoDestinoId: (m.fondoDestinoId as string | null) ?? null,
    recurrenteId: (m.recurrenteId as string | null) ?? null,
  }
  if (tipo === 'ingreso') {
    mov.distribuir = m.distribuir === undefined ? true : Boolean(m.distribuir)
    mov.reparto = m.reparto && typeof m.reparto === 'object' ? (m.reparto as Record<string, number>) : null
  }
  return mov
}

/** Completa campos faltantes y descarta valores inválidos. Sirve para datos guardados, respaldos e importaciones. */
export function normalizar(raw: unknown): Datos {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Crudo
  const aj = (d.ajustes && typeof d.ajustes === 'object' ? d.ajustes : {}) as Crudo
  const cuentas = arr<Cuenta>(d.cuentas).map((c) => ({ ...c, id: texto(c.id) || uid(), nombre: texto(c.nombre, 'Cuenta'), saldoInicial: numero(c.saldoInicial), fechaSaldo: texto(c.fechaSaldo, '2000-01-01') }))
  const fechaCuenta = (id: string | null) => cuentas.find((c) => c.id === id)?.fechaSaldo ?? null
  const fondos = arr<Crudo>(d.fondos).map((f) => normalizarFondo(f, fechaCuenta))
  const movimientos = arr<Crudo>(d.movimientos).map(normalizarMovimiento)
  // Cada ingreso repartido guarda los porcentajes con que se repartió, para que cambiar los % de un fondo
  // solo afecte a los ingresos nuevos y no reescriba el pasado.
  const pctActuales = Object.fromEntries(fondos.filter((f) => !f.archivado && f.porcentaje > 0).map((f) => [f.id, f.porcentaje]))
  for (const m of movimientos) if (m.tipo === 'ingreso' && m.distribuir !== false && !m.reparto) m.reparto = { ...pctActuales }
  return {
    categorias: arr<Categoria>(d.categorias).map((c) => ({ ...c, presupuesto: numero(c.presupuesto) })),
    metodos: arr<MetodoPago>(d.metodos),
    cuentas,
    fondos,
    gastos: arr<Gasto>(d.gastos).map((g) => ({ ...g, monto: numero(g.monto), recurrenteId: g.recurrenteId ?? null })),
    movimientos,
    recurrentes: arr<Recurrente>(d.recurrentes).map((r) => ({ ...r, creado: r.creado ?? `${r.desde ?? '2000-01'}-01`, omitidos: Array.isArray(r.omitidos) ? r.omitidos : [] })),
    escenarios: arr<Escenario>(d.escenarios).map((e) => ({ ...e, compras: arr(e.compras) })),
    ajustes: {
      moneda: texto(aj.moneda, 'Bs'),
      ingresoMensual: numero(aj.ingresoMensual),
      inflacionMensual: numero(aj.inflacionMensual),
      tema: aj.tema === 'claro' || aj.tema === 'oscuro' ? aj.tema : 'sistema',
    },
  }
}

/** Porcentajes vigentes de los fondos, para guardar con cada ingreso repartido. */
export function repartoActual(fondos: Fondo[]): Record<string, number> {
  return Object.fromEntries(fondos.filter((f) => !f.archivado && f.porcentaje > 0).map((f) => [f.id, f.porcentaje]))
}

export interface InformeMigracion {
  convertidos: number
  montoConvertido: number
  categoriasEliminadas: string[]
  fondoAhorro: string | null
  fondoCreado: boolean
}

/**
 * Convierte los gastos registrados en categorías de ahorro en transferencias hacia el fondo de ahorro.
 * - Fondo de origen: el fondo del gasto (o sin asignar). Si ya era el fondo de ahorro, el registro queda neutro para el
 *   fondo y solo deja de restar a la cuenta.
 * - Cuenta de destino: la cuenta del fondo de ahorro (o la del gasto).
 * Las categorías de ahorro que quedan sin gastos se eliminan: el ahorro ya no es una categoría de gasto.
 */
export function convertirAhorroEnAportes(
  d: Datos,
  opciones: { soloGastos?: Set<string>; existentes?: Movimiento[] } = {},
): InformeMigracion & { repetidos: number } {
  const informe = { convertidos: 0, montoConvertido: 0, categoriasEliminadas: [] as string[], fondoAhorro: null as string | null, fondoCreado: false, repetidos: 0 }
  const cats = d.categorias.filter((c) => RE_CATEGORIA_AHORRO.test(c.nombre))
  if (cats.length === 0) return informe
  const ids = new Set(cats.map((c) => c.id))
  const gastos = d.gastos.filter((g) => ids.has(g.categoriaId) && (!opciones.soloGastos || opciones.soloGastos.has(g.id)))
  // Aportes que ya existían (por ejemplo, de una conversión anterior): se cuentan para no duplicarlos.
  const clave = (m: Pick<Movimiento, 'fecha' | 'monto' | 'cuentaOrigenId' | 'cuentaDestinoId' | 'fondoDestinoId'>) => `${m.fecha}|${m.monto.toFixed(2)}|${m.cuentaOrigenId}|${m.cuentaDestinoId}|${m.fondoDestinoId}`
  const previos = new Map<string, number>()
  for (const m of opciones.existentes ?? []) if (m.tipo === 'transferencia') previos.set(clave(m), (previos.get(clave(m)) ?? 0) + 1)

  if (gastos.length > 0) {
    let destino =
      d.fondos.find((f) => f.tipo === 'ahorro' && /ahorr/i.test(f.nombre)) ?? d.fondos.find((f) => /ahorr/i.test(f.nombre)) ?? null
    if (!destino) {
      // Cuenta más usada por esos gastos.
      const cuenta = Object.entries(
        gastos.reduce<Record<string, number>>((a, g) => {
          if (g.cuentaId) a[g.cuentaId] = (a[g.cuentaId] ?? 0) + 1
          return a
        }, {}),
      ).sort((a, b) => b[1] - a[1])[0]?.[0]
      destino = fondoNuevo({ id: uid(), nombre: 'Ahorro', tipo: 'ahorro', icono: 'ahorro', cuentaId: cuenta ?? null })
      d.fondos.push(destino)
      informe.fondoCreado = true
    }
    destino.tipo = 'ahorro'
    informe.fondoAhorro = destino.nombre

    for (const g of gastos) {
      const cuentaDestino = destino.cuentaId ?? g.cuentaId
      const mov: Movimiento = {
        id: uid(),
        fecha: g.fecha,
        tipo: 'transferencia',
        descripcion: g.descripcion || 'Ahorro',
        cuentaOrigenId: g.cuentaId ?? cuentaDestino,
        cuentaDestinoId: cuentaDestino,
        monto: g.monto,
        fondoOrigenId: g.fondoId ?? null,
        fondoDestinoId: destino.id,
        recurrenteId: null,
      }
      informe.convertidos++
      informe.montoConvertido += g.monto
      const k = clave(mov)
      if ((previos.get(k) ?? 0) > 0) {
        previos.set(k, previos.get(k)! - 1)
        informe.repetidos++
        continue
      }
      // Si el gasto ya salía del fondo de ahorro y de su misma cuenta, basta con quitarlo: no hay dinero que mover.
      if (mov.cuentaOrigenId === mov.cuentaDestinoId && mov.fondoOrigenId === mov.fondoDestinoId) continue
      d.movimientos.push(mov)
    }
    const convertidos = new Set(gastos.map((g) => g.id))
    d.gastos = d.gastos.filter((g) => !convertidos.has(g.id))
  }

  for (const c of cats) {
    if (!d.gastos.some((g) => g.categoriaId === c.id)) {
      informe.categoriasEliminadas.push(c.nombre)
      d.categorias = d.categorias.filter((x) => x.id !== c.id)
      d.recurrentes = d.recurrentes.map((r) => (r.categoriaId === c.id ? { ...r, categoriaId: null } : r))
    }
  }
  return informe
}

/** Migra datos de cualquier versión anterior a la actual. */
export function migrar(raw: unknown, version: number): { datos: Datos; informe: InformeMigracion | null } {
  const datos = normalizar(raw)
  let informe: InformeMigracion | null = null
  if (version < 2) {
    informe = convertirAhorroEnAportes(datos)
  }
  return { datos, informe }
}
