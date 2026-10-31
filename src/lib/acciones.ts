import { useStore } from '../store'
import { metas } from './calc'
import { toast, vibrar } from './feedback'
import { hoyISO } from './format'
import { useUI } from './ui'
import type { Datos, Recurrente } from '../types'

/**
 * De dónde sale un gasto si el usuario no dice nada: lo mismo que la última vez en esa categoría
 * o, si es la primera vez, el primer fondo para gastar y su cuenta.
 */
export function origenPorDefecto(d: Datos, categoriaId: string | null): { fondoId: string; cuentaId: string; metodoId: string } {
  const fondoOk = (id: string | null | undefined) => Boolean(id && d.fondos.some((f) => f.id === id && !f.archivado))
  const cuentaOk = (id: string | null | undefined) => Boolean(id && d.cuentas.some((c) => c.id === id))
  const metodoOk = (id: string | null | undefined) => Boolean(id && d.metodos.some((m) => m.id === id))
  const orden = [...d.gastos].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const previo = categoriaId ? orden.find((g) => g.categoriaId === categoriaId) : undefined
  const ultimo = orden[0]
  const fondoGasto = d.fondos.find((f) => f.tipo === 'gasto' && !f.archivado)
  const fondoId = previo && fondoOk(previo.fondoId) ? previo.fondoId! : (fondoGasto?.id ?? '')
  const fondo = d.fondos.find((f) => f.id === fondoId)
  const cuentaId = previo && cuentaOk(previo.cuentaId) ? previo.cuentaId! : cuentaOk(fondo?.cuentaId) ? fondo!.cuentaId! : (d.cuentas[0]?.id ?? '')
  const metodoId = previo && metodoOk(previo.metodoId) ? previo.metodoId! : ultimo && metodoOk(ultimo.metodoId) ? ultimo.metodoId! : (d.metodos[0]?.id ?? '')
  return { fondoId, cuentaId, metodoId }
}

/** Marca un fijo como pagado (o cobrado) con su monto de siempre. */
export function registrarFijo(r: Recurrente, fecha: string) {
  const hoy = hoyISO()
  const s = useStore.getState()
  const id = s.registrarRecurrente(r.id, fecha > hoy ? hoy : fecha)
  vibrar(15)
  toast(r.tipo === 'gasto' ? `${r.nombre}: pagado` : `${r.nombre}: cobrado`, {
    accion: id
      ? {
          texto: 'Deshacer',
          onClick: () => (r.tipo === 'gasto' ? useStore.getState().eliminarGasto(id, { sinOmitir: true }) : useStore.getState().eliminarMovimiento(id, { sinOmitir: true })),
        }
      : undefined,
    duracion: 5000,
  })
  if (r.tipo === 'ingreso' && r.distribuir !== false && metas(useStore.getState()).some((m) => m.faltaEsteMes > 0.5)) {
    setTimeout(() => useUI.getState().abrirPagate(r.cuentaId), 350)
  }
}

/** Abre el registro con los datos del fijo para cambiar el monto u otro detalle antes de guardarlo. */
export function registrarFijoConCambios(r: Recurrente, fecha: string) {
  const hoy = hoyISO()
  const f = fecha > hoy ? hoy : fecha
  if (r.tipo === 'gasto') {
    useUI.getState().abrirRegistro({
      pestana: 'gasto',
      presetGasto: { fecha: f, categoriaId: r.categoriaId ?? '', descripcion: r.nombre, monto: r.monto, metodoId: r.metodoId, cuentaId: r.cuentaId, fondoId: r.fondoId, recurrenteId: r.id },
    })
  } else {
    useUI.getState().abrirRegistro({
      pestana: 'ingreso',
      preset: { fecha: f, descripcion: r.nombre, monto: r.monto, cuentaDestinoId: r.cuentaId, distribuir: r.distribuir !== false, fondoDestinoId: r.fondoId, recurrenteId: r.id },
    })
  }
}
