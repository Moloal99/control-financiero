import type { Datos } from '../types'
import { hoyISO } from './format'

export const COLORES = [
  'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)',
  'var(--c6)', 'var(--c7)', 'var(--c8)', 'var(--c9)', 'var(--c10)',
]

/** Datos iniciales: replican la configuración de la hoja RegistroGastosMensual.xlsm. */
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
      { id: 'cat-ahorro', nombre: 'Ahorro', presupuesto: 2500, color: COLORES[6], icono: 'ahorro' },
    ],
    metodos: [
      { id: 'met-efectivo', nombre: 'Efectivo' },
      { id: 'met-debito', nombre: 'Tarjeta de débito' },
      { id: 'met-credito', nombre: 'Tarjeta de crédito' },
      { id: 'met-qr', nombre: 'QR / Transferencia' },
    ],
    cuentas: [
      { id: 'cta-ganadero', nombre: 'Ganadero', tipo: 'Banco', saldoInicial: 0, fechaSaldo: hoy },
      { id: 'cta-bcp', nombre: 'BCP', tipo: 'Banco', saldoInicial: 0, fechaSaldo: hoy },
      { id: 'cta-bnb', nombre: 'BNB', tipo: 'Banco', saldoInicial: 0, fechaSaldo: hoy },
      { id: 'cta-efectivo', nombre: 'Efectivo', tipo: 'Efectivo', saldoInicial: 0, fechaSaldo: hoy },
    ],
    fondos: [
      { id: 'fon-gastos', nombre: 'Gastos', porcentaje: 0.5, cuentaId: 'cta-bnb', enSaldoNeto: true, icono: 'super' },
      { id: 'fon-compras', nombre: 'Compras', porcentaje: 0.1, cuentaId: 'cta-ganadero', enSaldoNeto: true, icono: 'compras' },
      { id: 'fon-ahorro', nombre: 'Ahorro', porcentaje: 0.3, cuentaId: 'cta-bcp', enSaldoNeto: true, icono: 'ahorro' },
      { id: 'fon-emergencias', nombre: 'Emergencias', porcentaje: 0.1, cuentaId: 'cta-bcp', enSaldoNeto: true, icono: 'emergencias' },
    ],
    gastos: [],
    movimientos: [],
  }
}
