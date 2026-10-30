export type ID = string

export interface Categoria {
  id: ID
  nombre: string
  presupuesto: number
  color: string
  /** Clave del catálogo de iconos (lib/iconos). Si falta, se sugiere por el nombre. */
  icono?: string
}

export interface MetodoPago {
  id: ID
  nombre: string
}

export type TipoCuenta = 'Banco' | 'Efectivo' | 'Billetera' | 'Otro'

export interface Cuenta {
  id: ID
  nombre: string
  tipo: TipoCuenta
  /** Saldo de la cuenta al inicio del día `fechaSaldo`, antes de los movimientos de ese día. */
  saldoInicial: number
  /** Fecha (yyyy-mm-dd) a la que corresponde el saldo inicial. */
  fechaSaldo: string
}

/**
 * Para qué es el dinero. Un fondo vive en una cuenta y su saldo se arrastra de un mes a otro.
 * - 'gasto': dinero para gastar (comida, compras…).
 * - 'ahorro': dinero apartado; puede tener una meta.
 */
export type TipoFondo = 'gasto' | 'ahorro'

export interface Meta {
  /** 'monto': monto fijo. 'emergencia': el objetivo es N meses de gasto promedio. */
  tipo: 'monto' | 'emergencia'
  objetivo: number
  /** Meses de gasto para el fondo de emergencia. */
  meses?: number
  /** Fecha objetivo (yyyy-mm-dd) o null si no tiene fecha. */
  fecha: string | null
  /** Fecha en que se creó la meta (yyyy-mm-dd). */
  creada: string
}

export interface Fondo {
  id: ID
  nombre: string
  /** Fracción del ingreso distribuido (0.5 = 50 %). */
  porcentaje: number
  cuentaId: ID | null
  enSaldoNeto: boolean
  icono?: string
  tipo: TipoFondo
  /** Saldo del fondo al inicio del día `fechaSaldo`. */
  saldoInicial: number
  /** Fecha (yyyy-mm-dd) del saldo inicial del fondo. Es propia del fondo: no cambia si el fondo se mueve de cuenta. */
  fechaSaldo: string
  /** Aporte mensual planificado (además del porcentaje), usado en proyecciones y en "Págate primero". */
  aporteMensual: number
  meta: Meta | null
  color?: string
  archivado?: boolean
}

export interface Gasto {
  id: ID
  fecha: string
  categoriaId: ID
  descripcion: string
  monto: number
  metodoId: ID | null
  cuentaId: ID | null
  fondoId: ID | null
  recurrenteId?: ID | null
}

/**
 * - ingreso: entra dinero a una cuenta. Puede distribuirse entre fondos o ir a un solo fondo (o a ninguno).
 * - transferencia: mueve dinero entre cuentas y/o entre fondos (apartar para una meta es una transferencia
 *   dentro de la misma cuenta, de un fondo a otro).
 * - ajuste: corrige el saldo de una cuenta para que coincida con el banco. `monto` puede ser negativo.
 */
export type TipoMovimiento = 'ingreso' | 'transferencia' | 'ajuste'

export interface Movimiento {
  id: ID
  fecha: string
  tipo: TipoMovimiento
  descripcion: string
  cuentaOrigenId: ID | null
  cuentaDestinoId: ID | null
  monto: number
  /** Ingreso: si se reparte entre fondos. Si falta se considera true (compatibilidad con datos antiguos). */
  distribuir?: boolean
  /** Ingreso distribuido: porcentajes propios de este ingreso por fondo. Si falta se usan los de cada fondo. */
  reparto?: Record<ID, number> | null
  /** Transferencia: fondo del que sale el dinero (null = sin asignar). */
  fondoOrigenId?: ID | null
  /** Transferencia, ingreso no distribuido o ajuste: fondo al que entra (null = sin asignar). */
  fondoDestinoId?: ID | null
  recurrenteId?: ID | null
}

export type Frecuencia = 'mensual' | 'anual'

/** Gasto o ingreso que se repite (alquiler, internet, sueldo…). */
export interface Recurrente {
  id: ID
  nombre: string
  tipo: 'gasto' | 'ingreso'
  monto: number
  /** Día del mes en que se paga o se cobra (1-31; si el mes es más corto, el último día). */
  dia: number
  frecuencia: Frecuencia
  /** Para frecuencia anual: mes (1-12). */
  mesAnual?: number
  categoriaId: ID | null
  fondoId: ID | null
  cuentaId: ID | null
  metodoId: ID | null
  /** Ingreso: si se distribuye entre fondos. */
  distribuir?: boolean
  /** Registrar solo al abrir la app cuando llega la fecha. */
  auto: boolean
  activo: boolean
  /** Primer mes (yyyy-mm) desde el que aplica. */
  desde: string
  /** Fecha en que se creó: los automáticos no se registran solos antes de esta fecha. */
  creado?: string
  /** Meses (yyyy-mm) en que el usuario borró el registro: no se vuelven a registrar solos. */
  omitidos?: string[]
}

export interface CompraPlaneada {
  id: ID
  nombre: string
  monto: number
  /** Mes (yyyy-mm). */
  mes: string
  fondoId: ID | null
}

/** Supuestos guardados para comparar contra la proyección base. */
export interface Escenario {
  id: ID
  nombre: string
  /** Variación del ingreso (0.1 = +10 %). */
  ingresoPct: number
  /** Recorte del gasto variable (0.1 = −10 %). */
  recortePct: number
  /** Ahorro extra mensual y fondo donde se aparta. */
  aporteExtra: number
  aporteFondoId: ID | null
  compras: CompraPlaneada[]
}

export interface Ajustes {
  moneda: string
  /** Ingreso esperado por mes cuando no hay ingresos registrados ni recurrentes. */
  ingresoMensual: number
  /** Fracción mensual (0.01 = 1 %). */
  inflacionMensual: number
  tema: 'claro' | 'oscuro' | 'sistema'
}

export interface Datos {
  categorias: Categoria[]
  metodos: MetodoPago[]
  cuentas: Cuenta[]
  fondos: Fondo[]
  gastos: Gasto[]
  movimientos: Movimiento[]
  recurrentes: Recurrente[]
  escenarios: Escenario[]
  ajustes: Ajustes
}

export type Estado = 'En control' | 'En riesgo' | 'Excedido'
