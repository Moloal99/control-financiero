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
  saldoInicial: number
  /** Fecha (yyyy-mm-dd) a la que corresponde el saldo inicial. */
  fechaSaldo: string
}

export interface Fondo {
  id: ID
  nombre: string
  /** Fracción del ingreso (0.5 = 50 %). */
  porcentaje: number
  cuentaId: ID | null
  enSaldoNeto: boolean
  icono?: string
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
}

export type TipoMovimiento = 'ingreso' | 'transferencia'

export interface Movimiento {
  id: ID
  fecha: string
  tipo: TipoMovimiento
  descripcion: string
  cuentaOrigenId: ID | null
  cuentaDestinoId: ID | null
  monto: number
}

export interface Ajustes {
  moneda: string
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
  ajustes: Ajustes
}

export type Estado = 'En control' | 'En riesgo' | 'Excedido'
