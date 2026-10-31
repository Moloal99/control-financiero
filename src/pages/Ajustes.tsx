import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleCheck, CreditCard, FileSpreadsheet, Monitor, Moon, Plus, SlidersHorizontal, Sun, Tags, TriangleAlert, Trash2, Wallet, Landmark } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { COLORES, DESDE_SIEMPRE } from '../lib/seed'
import { confirmar, toast } from '../lib/feedback'
import { fechaCorta, hoyISO, money, pct, uid } from '../lib/format'
import { saldosCuentas } from '../lib/calc'
import { ICONOS, ICONO_CUENTA, iconoDe, iconoMetodo, sugerirIcono } from '../lib/iconos'
import type { Categoria, Datos, Fondo, TipoCuenta } from '../types'
import { irA } from '../lib/ui'
import { fondoNuevo } from '../lib/seed'
import { CampoNumero, Card, Field, IconBadge, Modal, Segmented } from '../components/ui'

export function Ajustes() {
  const onIrA = irA
  const s = useStore()
  const totalPct = s.fondos.filter((f) => !f.archivado).reduce((a, f) => a + f.porcentaje, 0)
  const totalPresupuesto = s.categorias.reduce((a, c) => a + c.presupuesto, 0)
  const pctOk = Math.abs(totalPct - 1) < 0.0001
  const [editIcono, setEditIcono] = useState<{ tipo: 'cat'; item: Categoria } | { tipo: 'fon'; item: Fondo } | null>(null)
  const [mover, setMover] = useState<{ tipo: 'cuenta' | 'categoria'; id: string } | null>(null)
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({})
  const saldos = useMemo(() => saldosCuentas(s), [s])

  const eliminarCuenta = (id: string) => {
    const c = s.cuentas.find((x) => x.id === id)
    const sc = saldos.find((x) => x.cuenta.id === id)
    const enUso = Math.abs(sc?.saldoActual ?? 0) > 0.005 || s.fondos.some((f) => f.cuentaId === id) || s.gastos.some((g) => g.cuentaId === id) || s.movimientos.some((m) => m.cuentaOrigenId === id || m.cuentaDestinoId === id)
    if (enUso && s.cuentas.length > 1) setMover({ tipo: 'cuenta', id })
    else void eliminar('la cuenta', `"${c?.nombre}" no tiene saldo ni registros.`, () => s.eliminarCuenta(id))
  }
  const eliminarCategoria = (id: string) => {
    const c = s.categorias.find((x) => x.id === id)
    const usada = s.gastos.some((g) => g.categoriaId === id) || s.recurrentes.some((r) => r.categoriaId === id)
    if (usada && s.categorias.length > 1) setMover({ tipo: 'categoria', id })
    else void eliminar('la categoría', `"${c?.nombre}" no tiene gastos.`, () => s.eliminarCategoria(id))
  }
  /**
   * Al poner un saldo inicial a una cuenta o fondo que empezaba "desde siempre", se toma como el saldo que tenía
   * antes de su primer registro (así los registros ya hechos siguen contando). Sin registros, es el saldo de hoy.
   */
  const fechaParaSaldo = (fechaSaldo: string, n: number, fechas: string[]) => (n !== 0 && fechaSaldo < '1900' ? (fechas.filter(Boolean).sort()[0] ?? hoyISO()) : fechaSaldo)
  const fechasCuenta = (id: string) => [...s.gastos.filter((g) => g.cuentaId === id).map((g) => g.fecha), ...s.movimientos.filter((m) => m.cuentaOrigenId === id || m.cuentaDestinoId === id).map((m) => m.fecha)]
  const fechasFondo = (id: string) => [...s.gastos.filter((g) => g.fondoId === id).map((g) => g.fecha), ...s.movimientos.filter((m) => m.fondoOrigenId === id || m.fondoDestinoId === id || (m.tipo === 'ingreso' && m.distribuir !== false)).map((m) => m.fecha)]

  const eliminar = async (que: string, texto: string, accion: () => void) => {
    if (await confirmar(`¿Eliminar ${que}?`, { texto, aceptar: 'Eliminar', peligro: true })) {
      accion()
      toast(`Se eliminó ${que}`, { tono: "info" })
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <Card icon={SlidersHorizontal} title="Preferencias" subtitle="Ingreso de referencia, supuestos de proyección y apariencia">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Ingreso mensual (Bs)" hint="Se usa en los meses sin ingresos registrados">
            <CampoNumero valor={s.ajustes.ingresoMensual} onValor={(n) => s.setAjustes({ ingresoMensual: n })} />
          </Field>
          <Field label="Inflación mensual estimada (%)" hint="Para las proyecciones">
            <CampoNumero valor={s.ajustes.inflacionMensual * 100} onValor={(n) => s.setAjustes({ inflacionMensual: n / 100 })} />
          </Field>
          <Field label="Tema" className="sm:col-span-2 lg:col-span-1" grupo>
            <Segmented
              full
              value={s.ajustes.tema}
              onChange={(t: Datos['ajustes']['tema']) => s.setAjustes({ tema: t })}
              options={[
                { id: 'claro', label: 'Claro', icon: Sun },
                { id: 'oscuro', label: 'Oscuro', icon: Moon },
                { id: 'sistema', label: 'Auto', icon: Monitor },
              ]}
            />
          </Field>
        </div>
      </Card>

      <Card
        icon={Tags}
        title="Categorías y presupuesto"
        subtitle={`Presupuesto mensual total: ${money(totalPresupuesto, s.ajustes.moneda)}. Toca el icono para cambiarlo.`}
        action={
          <button
            className="btn btn-soft !min-h-9 !px-3 text-sm"
            onClick={() => s.guardarCategoria({ id: uid(), nombre: 'Nueva categoría', presupuesto: 0, color: COLORES[s.categorias.length % COLORES.length], icono: 'otros' })}
          >
            <Plus size={16} /> Agregar
          </button>
        }
      >
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {s.categorias.map((c) => (
              <motion.li key={c.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} className="flex items-center gap-2">
                <button className="rounded-xl hover:ring-2 hover:ring-primary/30 transition" onClick={() => setEditIcono({ tipo: 'cat', item: c })} aria-label={`Cambiar icono y color de ${c.nombre}`}>
                  <IconBadge icon={iconoDe(c)} color={c.color} solid />
                </button>
                <input className="input flex-1 min-w-0" value={c.nombre} onChange={(e) => s.guardarCategoria({ ...c, nombre: e.target.value })} aria-label="Nombre de la categoría" />
                <div className="relative w-28 sm:w-36 shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">Bs</span>
                  <CampoNumero className="!pl-9 text-right" valor={c.presupuesto} onValor={(n) => s.guardarCategoria({ ...c, presupuesto: n })} aria-label="Presupuesto mensual" />
                </div>
                <button className="btn btn-icon text-muted hover:!text-bad shrink-0" onClick={() => eliminarCategoria(c.id)} aria-label="Eliminar categoría">
                  <Trash2 size={17} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
        <Card
          icon={Landmark}
          title="Cuentas"
          subtitle="El saldo que tenía cada cuenta cuando empezaste a usar la app. Si no coincide con tu banco, usa Ajustar al banco en Cuentas."
          action={
            <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => s.guardarCuenta({ id: uid(), nombre: 'Nueva cuenta', tipo: 'Banco', saldoInicial: 0, fechaSaldo: DESDE_SIEMPRE })}>
              <Plus size={16} /> Agregar
            </button>
          }
        >
          <ul className="space-y-3">
            {s.cuentas.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <IconBadge icon={ICONO_CUENTA[c.tipo]} size="sm" />
                  <input className="input flex-1 min-w-0 !min-h-10 font-semibold" value={c.nombre} onChange={(e) => s.guardarCuenta({ ...c, nombre: e.target.value })} aria-label="Nombre de la cuenta" />
                  <button className="btn btn-icon text-muted hover:!text-bad" onClick={() => eliminarCuenta(c.id)} aria-label="Eliminar cuenta">
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  <select className="input !min-h-10 text-sm" value={c.tipo} onChange={(e) => s.guardarCuenta({ ...c, tipo: e.target.value as TipoCuenta })} aria-label="Tipo">
                    {(['Banco', 'Efectivo', 'Billetera', 'Otro'] as TipoCuenta[]).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <CampoNumero className="!min-h-10 text-sm text-right" valor={c.saldoInicial} onValor={(n) => s.guardarCuenta({ ...c, saldoInicial: n, fechaSaldo: fechaParaSaldo(c.fechaSaldo, n, fechasCuenta(c.id)) })} aria-label="Saldo inicial" />
                  {c.fechaSaldo > '1900' && (
                    <input className="input !min-h-10 text-sm col-span-2 sm:col-span-1" type="date" value={c.fechaSaldo} onChange={(e) => s.guardarCuenta({ ...c, fechaSaldo: e.target.value || DESDE_SIEMPRE })} aria-label="Fecha del saldo" title="Fecha de ese saldo: los registros anteriores no lo cambian" />
                  )}
                </div>
                <p className="text-xs text-muted mt-1.5">
                  Hoy: <b className="num text-ink">{money(saldos.find((x) => x.cuenta.id === c.id)?.saldoActual ?? 0, s.ajustes.moneda)}</b>
                  {c.fechaSaldo > '1900' ? ` · saldo inicial al ${fechaCorta(c.fechaSaldo)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          icon={Wallet}
          title="Fondos"
          subtitle="Para qué es tu dinero y cómo se reparte cada ingreso. El saldo de cada fondo pasa de un mes a otro."
          action={
            <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => s.guardarFondo(fondoNuevo({ id: uid(), nombre: 'Nuevo fondo', icono: 'metas', cuentaId: s.cuentas[0]?.id ?? null }))}>
              <Plus size={16} /> Agregar
            </button>
          }
        >
          {/* Barra apilada del reparto */}
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-3/70 mb-2">
            {s.fondos.filter((f) => !f.archivado).map((f, i) => (
              <motion.div key={f.id} className="h-full" initial={false} animate={{ width: `${Math.min(1, f.porcentaje) * 100}%` }} style={{ background: `var(--c${(i % 10) + 1})` }} title={`${f.nombre} ${pct(f.porcentaje)}`} />
            ))}
          </div>
          <p className={`text-xs font-semibold mb-3 inline-flex items-center gap-1.5 ${pctOk ? 'text-ok' : 'text-warn'}`}>
            {pctOk ? <CircleCheck size={14} /> : <TriangleAlert size={14} />}
            {pctOk ? 'El reparto suma 100%' : `El reparto suma ${pct(totalPct, 1)}; debe sumar 100%`}
          </p>
          <p className="text-xs text-muted -mt-2 mb-3">Cambiar los porcentajes solo afecta a los ingresos nuevos.</p>
          <ul className="space-y-3">
            {s.fondos.map((f, i) => (
              <li key={f.id} className="rounded-2xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <button className="rounded-[10px] hover:ring-2 hover:ring-primary/30 transition" onClick={() => setEditIcono({ tipo: 'fon', item: f })} aria-label={`Cambiar icono de ${f.nombre}`}>
                    <IconBadge icon={iconoDe(f)} size="sm" color={`var(--c${(i % 10) + 1})`} />
                  </button>
                  <input className="input flex-1 min-w-0 !min-h-10 font-semibold" value={f.nombre} onChange={(e) => s.guardarFondo({ ...f, nombre: e.target.value })} aria-label="Nombre del fondo" />
                  <div className="relative w-24 shrink-0">
                    <CampoNumero className="!min-h-10 text-right !pr-7" valor={Math.round(f.porcentaje * 100000) / 1000} onValor={(n) => s.guardarFondo({ ...f, porcentaje: n / 100 })} aria-label="Porcentaje del ingreso" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">%</span>
                  </div>
                  <button className="btn btn-icon text-muted hover:!text-bad" onClick={() => eliminar('el fondo', `Los gastos de "${f.nombre}" quedarán sin fondo.`, () => s.eliminarFondo(f.id))} aria-label="Eliminar fondo">
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <Segmented
                    full
                    size="sm"
                    value={f.tipo}
                    onChange={(t: Fondo['tipo']) => s.guardarFondo({ ...f, tipo: t })}
                    options={[
                      { id: 'gasto', label: 'Para gastar' },
                      { id: 'ahorro', label: 'Ahorro' },
                    ]}
                  />
                  <select className="input !min-h-10 text-sm" value={f.cuentaId ?? ''} onChange={(e) => s.guardarFondo({ ...f, cuentaId: e.target.value || null })} aria-label="Cuenta del fondo">
                    <option value="">Sin cuenta</option>
                    {s.cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        Vive en {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="text-xs font-bold text-primary mt-2.5" onClick={() => setAbiertos((a) => ({ ...a, [f.id]: !a[f.id] }))} aria-expanded={Boolean(abiertos[f.id])}>
                  {abiertos[f.id] ? 'Menos opciones' : 'Más opciones: saldo inicial, aporte fijo'}
                </button>
                {abiertos[f.id] && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div className="block sm:col-span-2">
                      <span className="block text-[11px] font-semibold text-muted mb-1">Saldo inicial{f.fechaSaldo > '1900' ? ' y su fecha' : ''}</span>
                      <div className="flex gap-1.5">
                        <CampoNumero className="!min-h-10 text-sm text-right flex-1 min-w-0" valor={f.saldoInicial} onValor={(n) => s.guardarFondo({ ...f, saldoInicial: n, fechaSaldo: fechaParaSaldo(f.fechaSaldo, n, fechasFondo(f.id)) })} aria-label="Saldo inicial del fondo" />
                        {f.fechaSaldo > '1900' && (
                          <input className="input !min-h-10 text-sm !w-[9.5rem] shrink-0" type="date" value={f.fechaSaldo} onChange={(e) => s.guardarFondo({ ...f, fechaSaldo: e.target.value || DESDE_SIEMPRE })} aria-label="Fecha del saldo del fondo" />
                        )}
                      </div>
                    </div>
                    <label className="block sm:col-span-2">
                      <span className="block text-[11px] font-semibold text-muted mb-1">Aporte fijo al mes (además del %)</span>
                      <CampoNumero className="!min-h-10 text-sm text-right" valor={f.aporteMensual} onValor={(n) => s.guardarFondo({ ...f, aporteMensual: n })} aria-label="Aporte mensual planificado" />
                    </label>
                    <label className="text-[13px] flex items-center gap-2 cursor-pointer select-none sm:col-span-2">
                      <input type="checkbox" checked={f.enSaldoNeto} onChange={(e) => s.guardarFondo({ ...f, enSaldoNeto: e.target.checked })} /> Cuenta en el saldo neto
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        icon={CreditCard}
        title="Métodos de pago"
        action={
          <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => s.guardarMetodo({ id: uid(), nombre: 'Nuevo método' })}>
            <Plus size={16} /> Agregar
          </button>
        }
      >
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {s.metodos.map((m) => {
            const I = iconoMetodo(m.nombre)
            return (
              <li key={m.id} className="flex items-center gap-1.5">
                <I size={18} className="text-muted shrink-0 ml-1" />
                <input className="input !min-h-10" value={m.nombre} onChange={(e) => s.guardarMetodo({ ...m, nombre: e.target.value })} aria-label="Método de pago" />
                <button className="btn btn-icon text-muted hover:!text-bad shrink-0" onClick={() => eliminar('el método', `Los gastos con "${m.nombre}" quedarán sin método de pago.`, () => s.eliminarMetodo(m.id))} aria-label="Eliminar método">
                  <Trash2 size={17} />
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <button onClick={() => onIrA('datos')} className="card w-full p-4 md:p-5 flex items-center gap-4 text-left hover:bg-surface-2 transition-colors">
        <IconBadge icon={FileSpreadsheet} color="var(--ok)" size="lg" />
        <div className="flex-1">
          <p className="font-bold">Importar, exportar y respaldos</p>
          <p className="text-sm text-muted">Descarga tus datos en Excel, carga un archivo o pasa tus datos a otro dispositivo.</p>
        </div>
      </button>

      <EliminarYMover abierto={mover} onClose={() => setMover(null)} />

      <SelectorIcono
        abierto={editIcono}
        onClose={() => setEditIcono(null)}
        onElegir={(icono, color) => {
          if (!editIcono) return
          if (editIcono.tipo === 'cat') s.guardarCategoria({ ...useStore.getState().categorias.find((c) => c.id === editIcono.item.id)!, icono, ...(color ? { color } : {}) })
          else s.guardarFondo({ ...useStore.getState().fondos.find((f) => f.id === editIcono.item.id)!, icono })
        }}
      />
    </div>
  )
}

/** Eliminar una cuenta o categoría en uso: su dinero y sus registros pasan a otra. */
function EliminarYMover({ abierto, onClose }: { abierto: { tipo: 'cuenta' | 'categoria'; id: string } | null; onClose: () => void }) {
  const s = useStore()
  const esCuenta = abierto?.tipo === 'cuenta'
  const lista: { id: string; nombre: string }[] = esCuenta ? s.cuentas : s.categorias
  const item = lista.find((x) => x.id === abierto?.id)
  const otras = lista.filter((x) => x.id !== abierto?.id)
  const [destino, setDestino] = useState('')
  const elegido = otras.some((x) => x.id === destino) ? destino : (otras[0]?.id ?? '')
  const saldo = esCuenta && item ? (saldosCuentas(s).find((x) => x.cuenta.id === item.id)?.saldoActual ?? 0) : 0
  const nGastos = item ? s.gastos.filter((g) => (esCuenta ? g.cuentaId : g.categoriaId) === item.id).length : 0
  const nFondos = esCuenta && item ? s.fondos.filter((f) => f.cuentaId === item.id).length : 0
  const confirmarEliminar = () => {
    if (!abierto || !elegido) return
    const nombreDestino = otras.find((x) => x.id === elegido)?.nombre
    if (esCuenta) s.eliminarCuenta(abierto.id, elegido)
    else s.eliminarCategoria(abierto.id, elegido)
    toast(`${esCuenta ? 'Cuenta' : 'Categoría'} eliminada`, { tono: 'info', detalle: `Todo pasó a ${nombreDestino}.` })
    onClose()
  }
  return (
    <Modal open={Boolean(abierto && item)} onClose={onClose} title={item ? `Eliminar ${item.nombre}` : 'Eliminar'}>
      {item && (
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            {esCuenta
              ? `${item.nombre} tiene ${money(saldo, s.ajustes.moneda)}${nFondos ? `, ${nFondos} ${nFondos === 1 ? 'fondo' : 'fondos'}` : ''} y ${nGastos} ${nGastos === 1 ? 'gasto' : 'gastos'}. Elige a qué cuenta pasa todo para que tus saldos sigan cuadrando.`
              : `${item.nombre} tiene ${nGastos} ${nGastos === 1 ? 'gasto' : 'gastos'}. Elige a qué categoría pasan para que tus totales sigan cuadrando.`}
          </p>
          <Field label={esCuenta ? 'Pasar todo a la cuenta' : 'Pasar los gastos a la categoría'}>
            <select className="input" value={elegido} onChange={(e) => setDestino(e.target.value)}>
              {otras.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn bg-bad text-white" onClick={confirmarEliminar} disabled={!elegido}>
              <Trash2 size={16} /> Eliminar y mover
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function SelectorIcono({
  abierto,
  onClose,
  onElegir,
}: {
  abierto: { tipo: 'cat'; item: Categoria } | { tipo: 'fon'; item: Fondo } | null
  onClose: () => void
  onElegir: (icono: string, color?: string) => void
}) {
  const item = useStore((s) => (abierto ? (abierto.tipo === 'cat' ? s.categorias : s.fondos).find((x) => x.id === abierto.item.id) : null))
  const actual = item?.icono ?? sugerirIcono(item?.nombre ?? '')
  const color = abierto?.tipo === 'cat' ? (item as Categoria | undefined)?.color : undefined
  return (
    <Modal open={Boolean(abierto)} onClose={onClose} title={item ? `Icono de ${item.nombre}` : 'Icono'}>
      {item && (
        <div className="space-y-5">
          {abierto?.tipo === 'cat' && (
            <Field label="Color" grupo>
              <div className="flex flex-wrap gap-2">
                {COLORES.map((c) => (
                  <button key={c} onClick={() => onElegir(actual, c)} className="h-10 w-10 rounded-full grid place-items-center text-white transition-transform hover:scale-110" style={{ background: c }} aria-label="Elegir color">
                    {color === c && <Check size={18} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Icono" grupo>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {Object.entries(ICONOS).map(([k, { icono: I, nombre }]) => {
                const activo = k === actual
                return (
                  <button
                    key={k}
                    onClick={() => onElegir(k)}
                    title={nombre}
                    aria-label={nombre}
                    className={`aspect-square rounded-xl grid place-items-center transition-colors ${activo ? 'text-white' : 'bg-surface-2 hover:bg-surface-3 text-ink'}`}
                    style={activo ? { background: color ?? 'var(--primary)' } : undefined}
                  >
                    <I size={20} />
                  </button>
                )
              })}
            </div>
          </Field>
          <button className="btn btn-primary w-full" onClick={onClose}>
            Listo
          </button>
        </div>
      )}
    </Modal>
  )
}
