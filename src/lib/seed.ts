import type { Datos, Fondo } from '../types'
import { hoyISO } from './format'

/** Fecha de saldo para cuentas y fondos que empiezan en 0: cuenta todos sus registros, también los de fechas pasadas. */
export const DESDE_SIEMPRE = '0000-01-01'

export const COLORES = [
  'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)',
  'var(--c6)', 'var(--c7)', 'var(--c8)', 'var(--c9)', 'var(--c10)',
]

/** Valores por defecto de un fondo nuevo. */
export function fondoNuevo(f: Partial<Fondo> & Pick<Fondo, 'id' | 'nombre'>): Fondo {
  return {
    porcentaje: 0,
    cuentaId: null,
    enSaldoNeto: true,
    tipo: 'gasto',
    saldoInicial: 0,
    fechaSaldo: DESDE_SIEMPRE,
    aporteMensual: 0,
    meta: null,
    ...f,
  }
}

/** Datos iniciales: replican la configuración de la hoja RegistroGastosMensual.xlsm. El ahorro vive en fondos, no en categorías de gasto. */
export function datosIniciales(): Datos {
  const hoy = hoyISO()
  return {
    ajustes: { moneda: 'Bs', ingresoMensual: 5300, inflacionMensual: 0, tema: 'sistema' },
    categorias: [
      { id: 'cat-comida', nombre: 'Comida', presupuesto: 1500, color: COLORES[0], icono: 'comida' },
      { id: 'cat-higiene', nombre: 'Higiene', presupuesto: 300, color: COLORES[1], icono: 'higiene' },
      { id: 'cat-transporte', nombre: 'Transporte', presupuesto: 200, color: COLORES[2], icono: 'transporte' },
      { id: 'cat-gimnasio', nombre: 'Gimnasio', presupuesto: 500, color: COLORES[3], icono: 'gimnasio' },
      { id: 'cat-amor', nombre: 'Amor', presupuesto: 100, color: COLORES[4], icono: 'amor' },
      { id: 'cat-extras', nombre: 'Extras / Suscripciones', presupuesto: 200, color: COLORES[5], icono: 'suscripciones' },
    ],
    metodos: [
      { id: 'met-efectivo', nombre: 'Efectivo' },
      { id: 'met-debito', nombre: 'Tarjeta de débito' },
      { id: 'met-credito', nombre: 'Tarjeta de crédito' },
      { id: 'met-qr', nombre: 'QR / Transferencia' },
    ],
    cuentas: [
      { id: 'cta-ganadero', nombre: 'Ganadero', tipo: 'Banco', saldoInicial: 0, fechaSaldo: DESDE_SIEMPRE },
      { id: 'cta-bcp', nombre: 'BCP', tipo: 'Banco', saldoInicial: 0, fechaSaldo: DESDE_SIEMPRE },
      { id: 'cta-bnb', nombre: 'BNB', tipo: 'Banco', saldoInicial: 0, fechaSaldo: DESDE_SIEMPRE },
      { id: 'cta-efectivo', nombre: 'Efectivo', tipo: 'Efectivo', saldoInicial: 0, fechaSaldo: DESDE_SIEMPRE },
    ],
    fondos: [
      fondoNuevo({ id: 'fon-gastos', nombre: 'Gastos', porcentaje: 0.5, cuentaId: 'cta-bnb', icono: 'super' }),
      fondoNuevo({ id: 'fon-compras', nombre: 'Compras', porcentaje: 0.1, cuentaId: 'cta-ganadero', icono: 'compras' }),
      fondoNuevo({ id: 'fon-ahorro', nombre: 'Ahorro', porcentaje: 0.3, cuentaId: 'cta-bcp', icono: 'ahorro', tipo: 'ahorro' }),
      fondoNuevo({
        id: 'fon-emergencias',
        nombre: 'Emergencias',
        porcentaje: 0.1,
        cuentaId: 'cta-bcp',
        icono: 'emergencias',
        tipo: 'ahorro',
        meta: { tipo: 'emergencia', objetivo: 0, meses: 3, fecha: null, creada: hoy },
      }),
    ],
    gastos: [],
    movimientos: [],
    recurrentes: [],
    escenarios: [],
  }
}
