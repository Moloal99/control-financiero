import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleCheck, CreditCard, FileSpreadsheet, Monitor, Moon, Plus, SlidersHorizontal, Sun, Tags, TriangleAlert, Trash2, Wallet, Landmark } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store'
import { COLORES } from '../lib/seed'
import { confirmar, toast } from '../lib/feedback'
import { hoyISO, money, num, pct, uid } from '../lib/format'
import { ICONOS, ICONO_CUENTA, iconoDe, iconoMetodo, sugerirIcono } from '../lib/iconos'
import type { Categoria, Datos, Fondo, TipoCuenta } from '../types'
import type { Vista } from '../components/Layout'
import { Card, Field, IconBadge, Modal, Segmented } from '../components/ui'

export function Ajustes({ onIrA }: { onIrA: (v: Vista) => void }) {
  const s = useStore()
  const totalPct = s.fondos.reduce((a, f) => a + f.porcentaje, 0)
  const totalPresupuesto = s.categorias.reduce((a, c) => a + c.presupuesto, 0)
  const pctOk = Math.abs(totalPct - 1) < 0.0001
  const [editIcono, setEditIcono] = useState<{ tipo: 'cat'; item: Categoria } | { tipo: 'fon'; item: Fondo } | null>(null)

  const eliminar = async (que: string, texto: string, accion: () => void) => {
    if (await confirmar(`¿Eliminar ${que}?`, { texto, aceptar: 'Eliminar', peligro: true })) {
      accion()
      toast(`${que.charAt(0).toUpperCase()}${que.slice(1)} eliminado`, { tono: 'info' })
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <Card icon={SlidersHorizontal} title="Preferencias" subtitle="Ingreso de referencia, supuestos de proyección y apariencia">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Ingreso mensual (Bs)" hint="Se usa en los meses sin ingresos registrados">
            <input className="input num" inputMode="decimal" value={s.ajustes.ingresoMensual} onChange={(e) => s.setAjustes({ ingresoMensual: num(e.target.value) })} />
          </Field>
          <Field label="Inflación mensual estimada (%)" hint="Para las proyecciones">
            <input className="input num" inputMode="decimal" defaultValue={(s.ajustes.inflacionMensual * 100).toFixed(2)} onBlur={(e) => s.setAjustes({ inflacionMensual: num(e.target.value) / 100 })} />
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
                  <input className="input !pl-9 text-right num" inputMode="decimal" value={c.presupuesto} onChange={(e) => s.guardarCategoria({ ...c, presupuesto: num(e.target.value) })} aria-label="Presupuesto mensual" />
                </div>
                <button className="btn btn-icon text-muted hover:!text-bad shrink-0" onClick={() => eliminar('la categoría', `Los gastos de "${c.nombre}" quedarán sin categoría.`, () => s.eliminarCategoria(c.id))} aria-label="Eliminar categoría">
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
          subtitle="Saldo inicial y la fecha a la que corresponde"
          action={
            <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => s.guardarCuenta({ id: uid(), nombre: 'Nueva cuenta', tipo: 'Banco', saldoInicial: 0, fechaSaldo: hoyISO() })}>
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
                  <button className="btn btn-icon text-muted hover:!text-bad" onClick={() => eliminar('la cuenta', `Los registros que usan "${c.nombre}" quedarán sin cuenta.`, () => s.eliminarCuenta(c.id))} aria-label="Eliminar cuenta">
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  <select className="input !min-h-10 text-sm" value={c.tipo} onChange={(e) => s.guardarCuenta({ ...c, tipo: e.target.value as TipoCuenta })} aria-label="Tipo">
                    {(['Banco', 'Efectivo', 'Billetera', 'Otro'] as TipoCuenta[]).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <input className="input !min-h-10 text-sm text-right num" inputMode="decimal" value={c.saldoInicial} onChange={(e) => s.guardarCuenta({ ...c, saldoInicial: num(e.target.value) })} aria-label="Saldo inicial" />
                  <input className="input !min-h-10 text-sm col-span-2 sm:col-span-1" type="date" value={c.fechaSaldo} onChange={(e) => s.guardarCuenta({ ...c, fechaSaldo: e.target.value })} aria-label="Fecha del saldo" />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          icon={Wallet}
          title="Fondos"
          subtitle="Cómo se reparte cada ingreso"
          action={
            <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => s.guardarFondo({ id: uid(), nombre: 'Nuevo fondo', porcentaje: 0, cuentaId: null, enSaldoNeto: true, icono: 'metas' })}>
              <Plus size={16} /> Agregar
            </button>
          }
        >
          {/* Barra apilada del reparto */}
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-3/70 mb-2">
            {s.fondos.map((f, i) => (
              <motion.div key={f.id} className="h-full" initial={false} animate={{ width: `${Math.min(1, f.porcentaje) * 100}%` }} style={{ background: `var(--c${(i % 10) + 1})` }} title={`${f.nombre} ${pct(f.porcentaje)}`} />
            ))}
          </div>
          <p className={`text-xs font-semibold mb-3 inline-flex items-center gap-1.5 ${pctOk ? 'text-ok' : 'text-warn'}`}>
            {pctOk ? <CircleCheck size={14} /> : <TriangleAlert size={14} />}
            {pctOk ? 'El reparto suma 100%' : `El reparto suma ${pct(totalPct, 1)}; debe sumar 100%`}
          </p>
          <ul className="space-y-3">
            {s.fondos.map((f, i) => (
              <li key={f.id} className="rounded-2xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <button className="rounded-[10px] hover:ring-2 hover:ring-primary/30 transition" onClick={() => setEditIcono({ tipo: 'fon', item: f })} aria-label={`Cambiar icono de ${f.nombre}`}>
                    <IconBadge icon={iconoDe(f)} size="sm" color={`var(--c${(i % 10) + 1})`} />
                  </button>
                  <input className="input flex-1 min-w-0 !min-h-10 font-semibold" value={f.nombre} onChange={(e) => s.guardarFondo({ ...f, nombre: e.target.value })} aria-label="Nombre del fondo" />
                  <div className="relative w-24 shrink-0">
                    <input className="input !min-h-10 text-right num !pr-7" inputMode="decimal" value={Math.round(f.porcentaje * 1000) / 10} onChange={(e) => s.guardarFondo({ ...f, porcentaje: num(e.target.value) / 100 })} aria-label="Porcentaje del ingreso" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">%</span>
                  </div>
                  <button className="btn btn-icon text-muted hover:!text-bad" onClick={() => eliminar('el fondo', `Los gastos de "${f.nombre}" quedarán sin fondo.`, () => s.eliminarFondo(f.id))} aria-label="Eliminar fondo">
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <select className="input !min-h-10 text-sm flex-1 min-w-36" value={f.cuentaId ?? ''} onChange={(e) => s.guardarFondo({ ...f, cuentaId: e.target.value || null })} aria-label="Cuenta del fondo">
                    <option value="">Sin cuenta</option>
                    {s.cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        Vive en {c.nombre}
                      </option>
                    ))}
                  </select>
                  <label className="text-[13px] flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={f.enSaldoNeto} onChange={(e) => s.guardarFondo({ ...f, enSaldoNeto: e.target.checked })} /> Cuenta en el saldo neto
                  </label>
                </div>
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
                <button className="btn btn-icon text-muted hover:!text-bad shrink-0" onClick={() => s.eliminarMetodo(m.id)} aria-label="Eliminar método">
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
