import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownLeft, CalendarClock, CalendarRange, Check, ChevronDown, CircleCheck, Flag, Lightbulb, Pencil, PiggyBank, Plus, Receipt, ShoppingBag, SlidersHorizontal, Sparkles, Target, Trash2, TrendingUp, Wallet, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { estaRegistrado, fechaOcurrencia, ingresoEsperado, mesesPrevios, proyeccionCategorias, proyectarSaldos, resumenMes } from '../lib/calc'
import { confirmar, toast, vibrar } from '../lib/feedback'
import { hoyISO, mesActual, mesDe, money, moneyShort, nombreMes, num, pct, uid } from '../lib/format'
import { useUI, type SubPlan } from '../lib/ui'
import { origenPorDefecto, registrarFijo, registrarFijoConCambios } from '../lib/acciones'
import { COLORES } from '../lib/seed'
import { iconoDe, sugerirIcono } from '../lib/iconos'
import type { CompraPlaneada, Escenario, Recurrente } from '../types'
import { Barra, CampoNumero, Card, Empty, EstadoPill, Field, IconBadge, KPI, Modal, Segmented, Switch, Td, Th, tonoEstado } from '../components/ui'

export function Plan({ mes }: { mes: string }) {
  const sub = useUI((u) => u.subPlan)
  const setSub = useUI((u) => u.setSubPlan)
  return (
    <div className="space-y-4 md:space-y-5">
      <Segmented<SubPlan>
        full
        className="md:!w-fit"
        value={sub}
        onChange={setSub}
        options={[
          { id: 'presupuesto', label: 'Presupuesto', icon: Wallet },
          { id: 'fijos', label: 'Fijos', icon: CalendarClock },
          { id: 'proyeccion', label: 'Proyección', icon: TrendingUp },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {sub === 'presupuesto' && <Presupuesto mes={mes} />}
          {sub === 'fijos' && <Fijos mes={mes} />}
          {sub === 'proyeccion' && <Proyeccion mes={mes} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ═════════════════════════ Presupuesto ═════════════════════════ */

function Presupuesto({ mes }: { mes: string }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const r = useMemo(() => resumenMes(s, mes), [s, mes])
  const [editando, setEditando] = useState(false)
  const [nueva, setNueva] = useState('')
  const ingreso = ingresoEsperado(s, mes)
  const aAhorro = s.fondos.filter((f) => f.tipo === 'ahorro' && !f.archivado).reduce((a, f) => a + ingresoEsperado(s, mes, true) * f.porcentaje + f.aporteMensual, 0)
  const libre = ingreso - r.presupuesto - aAhorro

  const agregar = () => {
    const nombre = nueva.trim()
    if (!nombre) return
    s.guardarCategoria({ id: uid(), nombre, presupuesto: 0, color: COLORES[s.categorias.length % COLORES.length], icono: sugerirIcono(nombre) })
    setNueva('')
    vibrar(12)
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <Card icon={SlidersHorizontal} title="Tu plan del mes" subtitle="Cada boliviano con un destino: gastos, ahorro y lo que queda libre">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Bloque k="Ingreso esperado" v={money(ingreso, mon)} cls="text-ok" />
          <Bloque k="Presupuesto de gastos" v={money(r.presupuesto, mon)} />
          <Bloque k="Va a ahorro" v={money(aAhorro, mon)} cls="text-ok" />
          <Bloque k={libre >= 0 ? 'Queda sin plan' : 'Te falta'} v={money(Math.abs(libre), mon)} cls={libre < -0.5 ? 'text-bad' : ''} />
        </div>
        {ingreso > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-3/60 mt-4 gap-0.5">
            <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (r.presupuesto / ingreso) * 100)}%` }} />
            <motion.div className="h-full bg-ok" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (aAhorro / ingreso) * 100)}%` }} />
          </div>
        )}
        <p className="text-xs text-muted mt-3">
          {libre < -0.5
            ? 'Tu presupuesto y tu ahorro superan lo que esperas ganar. Baja algún presupuesto o el % de tus fondos.'
            : libre > 0.5
              ? 'Puedes asignar lo que queda a una meta o a una categoría.'
              : 'Tu ingreso está completamente planificado.'}
        </p>
      </Card>

      <Card
        title={`Presupuesto por categoría, ${nombreMes(mes).toLowerCase()}`}
        subtitle={editando ? 'Escribe cuánto quieres gastar al mes en cada categoría' : 'Gastado frente a lo presupuestado'}
        padding={false}
        action={
          <button className={`btn ${editando ? 'btn-primary' : 'btn-soft'} !min-h-9 !px-3 text-sm`} onClick={() => setEditando((e) => !e)}>
            {editando ? (
              <>
                <Check size={16} /> Listo
              </>
            ) : (
              <>
                <Pencil size={15} /> Editar
              </>
            )}
          </button>
        }
      >
        <ul className="divide-y divide-line mt-2">
          {r.categorias.map((c) => {
            const Icono = iconoDe(c.categoria)
            const real = s.categorias.find((x) => x.id === c.categoria.id)
            if (editando && real) {
              return (
                <li key={c.categoria.id} className="px-4 md:px-5 py-2.5 flex items-center gap-3">
                  <IconBadge icon={Icono} color={c.categoria.color} size="sm" />
                  <input className="input flex-1 min-w-0 !min-h-10" value={real.nombre} onChange={(e) => s.guardarCategoria({ ...real, nombre: e.target.value })} aria-label="Nombre de la categoría" />
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">{mon}</span>
                    <CampoNumero className="!min-h-10 !pl-9 text-right font-bold" valor={real.presupuesto} onValor={(n) => s.guardarCategoria({ ...real, presupuesto: n })} aria-label={`Presupuesto de ${real.nombre}`} />
                  </div>
                </li>
              )
            }
            return (
              <li key={c.categoria.id || 'sin'} className="px-4 md:px-5 py-3.5 flex items-center gap-3 md:gap-4">
                <IconBadge icon={Icono} color={c.categoria.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold truncate">{c.categoria.nombre}</p>
                    <p className={`num text-sm font-bold shrink-0 ${c.disponible < 0 ? 'text-bad' : ''}`}>
                      {c.presupuesto <= 0 && c.gastado <= 0 ? <span className="text-muted font-semibold">Sin presupuesto</span> : <>{c.disponible < 0 ? 'Excede ' : 'Quedan '}{money(Math.abs(c.disponible), mon)}</>}
                    </p>
                  </div>
                  <div className="my-1.5">
                    <Barra pct={c.pctUsado} tone={tonoEstado(c.estado)} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <span className="num truncate">
                      {money(c.gastado, mon)} de {money(c.presupuesto, mon)}
                      <span className="hidden sm:inline">
                        , al ritmo actual {money(c.proyeccion, mon)} al cierre
                      </span>
                    </span>
                    <span className="shrink-0 hidden min-[400px]:inline">
                      <EstadoPill estado={c.estado} />
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {editando && (
          <form
            className="px-4 md:px-5 py-3 border-t border-line flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              agregar()
            }}
          >
            <input className="input flex-1 min-w-0 !min-h-10" placeholder="Nueva categoría (por ejemplo, Salud)" value={nueva} onChange={(e) => setNueva(e.target.value)} aria-label="Nueva categoría" />
            <button type="submit" className="btn btn-soft !min-h-10" disabled={!nueva.trim()}>
              <Plus size={16} /> Agregar
            </button>
          </form>
        )}
        <div className="px-4 md:px-5 py-3.5 border-t border-line bg-surface-2/60 rounded-b-[1.25rem] flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold">Total del mes</span>
          <span className="num text-muted">
            <b className="text-ink">{money(r.gasto, mon)}</b> de {money(r.presupuesto, mon)} ({pct(r.pctUsado)})
          </span>
        </div>
      </Card>
      {editando && <p className="text-xs text-muted -mt-2 px-1">Para cambiar iconos o eliminar categorías, ve a Ajustes.</p>}
    </div>
  )
}

function Bloque({ k, v, cls = '' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3 min-w-0">
      <p className="text-xs text-muted">{k}</p>
      <p className={`num font-extrabold text-lg truncate ${cls}`}>{v}</p>
    </div>
  )
}

/* ═════════════════════════ Fijos (recurrentes) ═════════════════════════ */

interface Sugerencia {
  descripcion: string
  monto: number
  dia: number
  categoriaId: string
  fondoId: string | null
  cuentaId: string | null
  metodoId: string | null
}

/** Gastos con la misma descripción en al menos 2 de los últimos 3 meses y montos parecidos. */
function sugerirFijos(s: ReturnType<typeof useStore.getState>, mes: string): Sugerencia[] {
  const previos = mesesPrevios(mes, 3)
  const existentes = new Set(s.recurrentes.map((r) => r.nombre.trim().toLowerCase()))
  const grupos = new Map<string, typeof s.gastos>()
  for (const g of s.gastos) {
    if (g.recurrenteId || !g.descripcion || !previos.includes(mesDe(g.fecha))) continue
    const k = g.descripcion.trim().toLowerCase()
    grupos.set(k, [...(grupos.get(k) ?? []), g])
  }
  const out: Sugerencia[] = []
  for (const [k, gs] of grupos) {
    if (existentes.has(k)) continue
    const meses = new Set(gs.map((g) => mesDe(g.fecha)))
    if (meses.size < 2 || gs.length > meses.size + 1) continue
    const montos = gs.map((g) => g.monto)
    const prom = montos.reduce((a, b) => a + b, 0) / montos.length
    if (Math.max(...montos) - Math.min(...montos) > prom * 0.15) continue
    const ult = gs.sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    out.push({ descripcion: ult.descripcion, monto: Math.round(prom * 100) / 100, dia: Number(ult.fecha.slice(8, 10)), categoriaId: ult.categoriaId, fondoId: ult.fondoId, cuentaId: ult.cuentaId, metodoId: ult.metodoId })
  }
  return out.slice(0, 5)
}

const omitido = (r: Recurrente, mes: string) => (r.omitidos ?? []).includes(mes)

function Fijos({ mes }: { mes: string }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const [editar, setEditar] = useState<{ r: Recurrente | null; base?: Partial<Recurrente> } | null>(null)
  const ingresos = s.recurrentes.filter((r) => r.tipo === 'ingreso')
  const gastos = s.recurrentes.filter((r) => r.tipo === 'gasto')
  const sugerencias = useMemo(() => sugerirFijos(useStore.getState(), mesActual()), [s.gastos, s.recurrentes]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalGastos = gastos.filter((r) => r.activo && fechaOcurrencia(r, mes)).reduce((a, r) => a + r.monto, 0)
  const totalIngresos = ingresos.filter((r) => r.activo && fechaOcurrencia(r, mes)).reduce((a, r) => a + r.monto, 0)
  const pendientes = s.recurrentes.filter((r) => r.activo && fechaOcurrencia(r, mes) && !estaRegistrado(s, r, mes) && !omitido(r, mes))

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={ArrowDownLeft} label="Ingresos fijos" value={money(totalIngresos, mon)} tone="ok" hint={nombreMes(mes)} />
        <KPI icon={Receipt} label="Gastos fijos" value={money(totalGastos, mon)} hint={totalIngresos > 0 ? `${pct(totalGastos / totalIngresos)} de tus ingresos fijos` : nombreMes(mes)} />
        <KPI icon={CalendarClock} label="Por pagar o cobrar" value={String(pendientes.length)} tone={pendientes.length ? 'warn' : 'ok'} hint={pendientes.length ? money(pendientes.reduce((a, r) => a + r.monto, 0), mon) : 'todo al día'} />
        <KPI icon={Zap} label="Se anotan solos" value={String(s.recurrentes.filter((r) => r.auto && r.activo).length)} hint="al abrir la app" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => setEditar({ r: null, base: { tipo: 'gasto' } })}>
          <Plus size={18} /> Gasto fijo
        </button>
        <button className="btn btn-soft" onClick={() => setEditar({ r: null, base: { tipo: 'ingreso', nombre: ingresos.length ? '' : 'Sueldo', monto: ingresos.length ? undefined : s.ajustes.ingresoMensual, dia: 1 } })}>
          <Plus size={18} /> Ingreso fijo
        </button>
      </div>

      {sugerencias.length > 0 && (
        <Card icon={Lightbulb} title="¿Son gastos fijos?" subtitle="Se repiten casi igual en los últimos meses">
          <ul className="divide-y divide-line -my-1">
            {sugerencias.map((x) => (
              <li key={x.descripcion} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{x.descripcion}</p>
                  <p className="text-xs text-muted">Cerca del día {x.dia}, unos {money(x.monto, mon)}</p>
                </div>
                <button
                  className="btn btn-soft !min-h-9 !px-3 text-sm"
                  onClick={() => setEditar({ r: null, base: { nombre: x.descripcion, tipo: 'gasto', monto: x.monto, dia: x.dia, categoriaId: x.categoriaId, fondoId: x.fondoId, cuentaId: x.cuentaId, metodoId: x.metodoId } })}
                >
                  <Plus size={15} /> Agregar
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {s.recurrentes.length === 0 ? (
        <Card>
          <Empty icon={CalendarClock} title="Anota tus fijos una sola vez">
            Sueldo, alquiler, internet, gimnasio, suscripciones. Cada mes aparecen en Inicio para marcarlos como pagados con un toque (o se anotan solos), y la proyección los usa.
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListaFijos titulo="Gastos fijos" lista={gastos} mes={mes} onEditar={(r) => setEditar({ r })} />
          <ListaFijos titulo="Ingresos fijos" lista={ingresos} mes={mes} onEditar={(r) => setEditar({ r })} />
        </div>
      )}

      <Modal open={Boolean(editar)} onClose={() => setEditar(null)} title={editar?.r ? `Editar ${editar.r.nombre}` : editar?.base?.tipo === 'ingreso' ? 'Nuevo ingreso fijo' : 'Nuevo gasto fijo'}>
        {editar && <FormFijo key={editar.r?.id ?? JSON.stringify(editar.base ?? {})} r={editar.r} base={editar.base} onClose={() => setEditar(null)} />}
      </Modal>
    </div>
  )
}

function ListaFijos({ titulo, lista, mes, onEditar }: { titulo: string; lista: Recurrente[]; mes: string; onEditar: (r: Recurrente) => void }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  return (
    <Card title={titulo} subtitle={lista.length ? `${lista.length} ${lista.length === 1 ? 'registrado' : 'registrados'}. Toca uno para editarlo.` : undefined} padding={false}>
      {lista.length === 0 ? (
        <div className="px-4 pb-4">
          <Empty>Ninguno todavía.</Empty>
        </div>
      ) : (
        <ul className="divide-y divide-line mt-2">
          {lista
            .slice()
            .sort((a, b) => a.dia - b.dia)
            .map((r) => {
              const fecha = fechaOcurrencia(r, mes)
              const hecho = fecha ? estaRegistrado(s, r, mes) : false
              const saltado = omitido(r, mes)
              const cat = s.categorias.find((c) => c.id === r.categoriaId)
              const fondo = s.fondos.find((f) => f.id === r.fondoId)
              return (
                <li key={r.id} className={`px-4 md:px-5 py-3 flex items-center gap-3 ${r.activo ? '' : 'opacity-55'}`}>
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-surface-2 grid place-items-center text-center leading-none">
                    <span>
                      <span className="block text-[10px] text-muted">día</span>
                      <span className="num font-extrabold text-sm">{r.dia}</span>
                    </span>
                  </span>
                  <button className="flex-1 min-w-0 text-left" onClick={() => onEditar(r)}>
                    <p className="font-semibold truncate">
                      {r.nombre}
                      {r.auto && <Zap size={12} className="inline ml-1 text-accent -mt-0.5" aria-label="Se anota solo" />}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {r.frecuencia === 'anual' ? `Cada año en ${nombreMes(`2000-${String(r.mesAnual ?? 1).padStart(2, '0')}`).split(' ')[0].toLowerCase()}` : 'Cada mes'}
                      {cat ? `, ${cat.nombre}` : ''}
                      {r.tipo === 'ingreso' ? (r.distribuir !== false ? ', se reparte' : fondo ? `, a ${fondo.nombre}` : ', sin repartir') : fondo ? `, de ${fondo.nombre}` : ''}
                    </p>
                  </button>
                  <div className="text-right shrink-0">
                    <p className={`num font-bold text-sm ${r.tipo === 'ingreso' ? 'text-ok' : ''}`}>{money(r.monto, mon)}</p>
                    {!r.activo ? (
                      <p className="text-[11px] text-muted">pausado</p>
                    ) : !fecha ? (
                      <p className="text-[11px] text-muted">no este mes</p>
                    ) : hecho ? (
                      <p className="text-[11px] text-ok font-semibold inline-flex items-center gap-0.5">
                        <CircleCheck size={11} /> {r.tipo === 'gasto' ? 'pagado' : 'cobrado'}
                      </p>
                    ) : saltado ? (
                      <button className="text-[11px] text-muted font-semibold" onClick={() => registrarFijoConCambios(r, fecha)} title="Lo borraste este mes. Tócalo para registrarlo igual.">
                        omitido este mes
                      </button>
                    ) : (
                      <button className="text-[11px] text-primary font-bold" onClick={() => registrarFijo(r, fecha)}>
                        {r.tipo === 'gasto' ? 'Marcar pagado' : 'Marcar cobrado'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
        </ul>
      )}
    </Card>
  )
}

function FormFijo({ r, base, onClose }: { r: Recurrente | null; base?: Partial<Recurrente>; onClose: () => void }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const ini = { ...base, ...r }
  const [defecto] = useState(() => origenPorDefecto(s, ini.categoriaId ?? null))
  const [tipo, setTipo] = useState<Recurrente['tipo']>(ini.tipo ?? 'gasto')
  const [nombre, setNombre] = useState(ini.nombre ?? '')
  const [monto, setMonto] = useState(ini.monto ? String(ini.monto).replace('.', ',') : '')
  const [dia, setDia] = useState(String(ini.dia ?? Number(hoyISO().slice(8, 10))))
  const [frecuencia, setFrecuencia] = useState<Recurrente['frecuencia']>(ini.frecuencia ?? 'mensual')
  const [mesAnual, setMesAnual] = useState(() => String(ini.mesAnual ?? Number(hoyISO().slice(5, 7))))
  const [categoriaId, setCategoriaId] = useState(ini.categoriaId ?? '')
  const [fondoId, setFondoId] = useState(r ? (r.fondoId ?? '') : (ini.fondoId ?? (ini.tipo === 'ingreso' ? '' : defecto.fondoId)))
  const [cuentaId, setCuentaId] = useState(r ? (r.cuentaId ?? '') : (ini.cuentaId ?? (ini.tipo === 'ingreso' ? (s.cuentas[0]?.id ?? '') : defecto.cuentaId)))
  const [metodoId, setMetodoId] = useState(r ? (r.metodoId ?? '') : (ini.metodoId ?? defecto.metodoId))
  const [distribuir, setDistribuir] = useState(ini.distribuir ?? true)
  const [auto, setAuto] = useState(ini.auto ?? false)
  const [activo, setActivo] = useState(ini.activo ?? true)
  const [desde, setDesde] = useState(ini.desde ?? mesActual())
  const [mas, setMas] = useState(false)
  const [tocado, setTocado] = useState(Boolean(r || base?.fondoId || base?.cuentaId))

  const elegirCategoria = (id: string) => {
    setCategoriaId(id)
    if (tocado) return
    const o = origenPorDefecto(s, id)
    setFondoId(o.fondoId)
    setCuentaId(o.cuentaId)
    setMetodoId(o.metodoId)
  }

  const validacion = !nombre.trim() ? 'Ponle un nombre' : !(num(monto) > 0) ? 'Ingresa el monto' : !(num(dia) >= 1 && num(dia) <= 31) ? 'El día va de 1 a 31' : tipo === 'gasto' && !categoriaId ? 'Elige la categoría' : !cuentaId ? 'Elige la cuenta' : null

  const guardar = () => {
    if (validacion) return
    const campos = {
      nombre: nombre.trim(),
      tipo,
      monto: num(monto),
      dia: Math.round(num(dia)),
      frecuencia,
      mesAnual: frecuencia === 'anual' ? Number(mesAnual) : undefined,
      categoriaId: tipo === 'gasto' ? categoriaId : null,
      fondoId: tipo === 'ingreso' && distribuir ? null : fondoId || null,
      cuentaId: cuentaId || null,
      metodoId: tipo === 'gasto' ? metodoId || null : null,
      distribuir: tipo === 'ingreso' ? distribuir : undefined,
      auto,
      activo,
      desde,
    }
    // Al editar se conservan la fecha de creación y los meses omitidos.
    const nuevo: Recurrente = r ? { ...r, ...campos } : { id: uid(), ...campos }
    s.guardarRecurrente(nuevo)
    vibrar(18)
    toast(r ? 'Fijo actualizado' : 'Fijo agregado', { detalle: `${money(nuevo.monto, mon)} el día ${nuevo.dia}${r ? '' : '. Aparecerá en Inicio cuando toque pagarlo.'}` })
    onClose()
  }

  const eliminar = async () => {
    if (!r) return
    if (!(await confirmar(`¿Eliminar ${r.nombre}?`, { texto: 'Los registros que ya hiciste se mantienen.', aceptar: 'Eliminar', peligro: true }))) return
    s.eliminarRecurrente(r.id)
    toast('Fijo eliminado', { tono: 'info' })
    onClose()
  }

  const fondosLista = s.fondos.filter((f) => !f.archivado || f.id === fondoId)

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      {!r && (
        <Segmented
          full
          value={tipo}
          onChange={(t) => {
            setTipo(t)
            if (t === 'ingreso' && !tocado) setFondoId('')
          }}
          options={[
            { id: 'gasto', label: 'Gasto fijo', icon: ShoppingBag },
            { id: 'ingreso', label: 'Ingreso fijo', icon: ArrowDownLeft },
          ]}
        />
      )}
      <Field label="Nombre">
        <input className="input" placeholder={tipo === 'gasto' ? 'Alquiler, internet, gimnasio…' : 'Sueldo'} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Monto (${mon})`}>
          <input className="input num font-bold" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Field>
        <Field label={tipo === 'gasto' ? 'Se paga el día' : 'Llega el día'}>
          <input className="input num" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} />
        </Field>
      </div>
      {tipo === 'gasto' ? (
        <Field label="Categoría" grupo>
          <div className="flex flex-wrap gap-2">
            {s.categorias.map((c) => {
              const I = iconoDe(c)
              const activoC = c.id === categoriaId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => elegirCategoria(c.id)}
                  aria-pressed={activoC}
                  className={`inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl text-sm font-semibold border transition-colors ${activoC ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface hover:bg-surface-2'}`}
                >
                  <I size={16} style={{ color: activoC ? undefined : c.color }} /> {c.nombre}
                </button>
              )
            })}
          </div>
        </Field>
      ) : (
        <>
          <Field label="Llega a">
            <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">Elegir cuenta</option>
              {s.cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-2xl border border-line p-4">
            <Switch checked={distribuir} onChange={setDistribuir} label="Repartir entre mis fondos" descripcion="Con los porcentajes de cada fondo." />
          </div>
        </>
      )}
      <div className="rounded-2xl border border-line p-4">
        <Switch checked={auto} onChange={setAuto} label="Anotarlo solo" descripcion={auto ? 'Se registra solo al abrir la app cuando llega el día.' : 'Te lo recordamos en Inicio y lo marcas como pagado con un toque. Mejor si el monto cambia cada mes.'} />
      </div>

      <div className="rounded-2xl border border-line">
        <button type="button" onClick={() => setMas((m) => !m)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2 rounded-2xl transition-colors" aria-expanded={mas}>
          <span className="min-w-0">
            <span className="block text-sm font-bold">Más opciones</span>
            <span className="block text-xs text-muted truncate">
              {[
                frecuencia === 'anual' ? 'Cada año' : 'Cada mes',
                tipo === 'gasto' ? (s.fondos.find((f) => f.id === fondoId)?.nombre ? `de ${s.fondos.find((f) => f.id === fondoId)?.nombre}` : 'sin fondo') : null,
                tipo === 'gasto' ? s.cuentas.find((c) => c.id === cuentaId)?.nombre : null,
                activo ? null : 'pausado',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <motion.span animate={{ rotate: mas ? 180 : 0 }}>
            <ChevronDown size={18} className="text-muted" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {mas && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 pb-4 pt-1 space-y-4 border-t border-line">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Se repite">
                    <select className="input" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Recurrente['frecuencia'])}>
                      <option value="mensual">Cada mes</option>
                      <option value="anual">Cada año</option>
                    </select>
                  </Field>
                  {frecuencia === 'anual' ? (
                    <Field label="Mes">
                      <select className="input" value={mesAnual} onChange={(e) => setMesAnual(e.target.value)}>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {nombreMes(`2000-${String(i + 1).padStart(2, '0')}`).split(' ')[0]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Desde el mes">
                      <input className="input" type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
                    </Field>
                  )}
                </div>
                {tipo === 'gasto' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Sale del fondo">
                      <select
                        className="input"
                        value={fondoId}
                        onChange={(e) => {
                          setFondoId(e.target.value)
                          setTocado(true)
                          const c = s.fondos.find((f) => f.id === e.target.value)?.cuentaId
                          if (c) setCuentaId(c)
                        }}
                      >
                        <option value="">Sin fondo</option>
                        {fondosLista.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nombre}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Se paga desde">
                      <select
                        className="input"
                        value={cuentaId}
                        onChange={(e) => {
                          setCuentaId(e.target.value)
                          setTocado(true)
                        }}
                      >
                        <option value="">Elegir cuenta</option>
                        {s.cuentas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Método de pago">
                      <select className="input" value={metodoId} onChange={(e) => setMetodoId(e.target.value)}>
                        <option value="">Sin especificar</option>
                        {s.metodos.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}
                {tipo === 'ingreso' && !distribuir && (
                  <Field label="Va al fondo">
                    <select className="input" value={fondoId} onChange={(e) => setFondoId(e.target.value)}>
                      <option value="">Sin asignar</option>
                      {fondosLista.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Switch checked={activo} onChange={setActivo} label="Activo" descripcion="Páusalo si deja de aplicar por un tiempo." />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {r && (
        <button type="button" className="btn btn-danger w-full" onClick={eliminar}>
          <Trash2 size={16} /> Eliminar
        </button>
      )}
      <div className="sticky -bottom-4 md:-bottom-5 -mx-4 md:-mx-5 -mb-4 md:-mb-5 px-4 md:px-5 pt-3 pb-4 md:pb-5 bg-surface border-t border-line flex items-center justify-between gap-3 z-10">
        <p className={`text-[13px] font-semibold ${validacion ? 'text-muted' : 'text-ok'}`}>{validacion ?? 'Listo para guardar'}</p>
        <button type="submit" className="btn btn-primary" disabled={Boolean(validacion)}>
          {r ? 'Guardar cambios' : 'Agregar'}
        </button>
      </div>
    </form>
  )
}

/* ═════════════════════════ Proyección ═════════════════════════ */

const ESCENARIO_VACIO = (): Escenario => ({ id: uid(), nombre: 'Nuevo escenario', ingresoPct: 0, recortePct: 0, aporteExtra: 0, aporteFondoId: null, compras: [] })

function Proyeccion({ mes }: { mes: string }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const [n, setN] = useState(12)
  const [escId, setEscId] = useState<string>('base')
  const [editar, setEditar] = useState<Escenario | null>(null)
  const [verCategorias, setVerCategorias] = useState(false)
  const esc = s.escenarios.find((e) => e.id === escId) ?? null
  const base = useMemo(() => proyectarSaldos(s, mes, n), [s, mes, n])
  const alt = useMemo(() => (esc ? proyectarSaldos(s, mes, n, esc) : null), [s, mes, n, esc])
  const cats = useMemo(() => proyeccionCategorias(s, mes, Math.min(n, 12)), [s, mes, n])
  const metasF = s.fondos.filter((f) => f.meta && !f.archivado)
  const fin = base.meses[base.meses.length - 1]
  const finAlt = alt?.meses[alt.meses.length - 1]
  const ahorroMensual = (fin.ahorro - base.inicial.ahorro) / n

  const data = base.meses.map((m, i) => ({
    nombre: nombreMes(m.mes, true),
    total: m.total,
    ahorro: m.ahorro,
    totalEsc: alt?.meses[i].total,
    ahorroEsc: alt?.meses[i].ahorro,
  }))

  return (
    <div className="space-y-4 md:space-y-5">
      <Card icon={SlidersHorizontal} title="Supuestos" subtitle="Ingresos: tus fijos (o el ingreso de Ajustes). Gasto variable: promedio de los últimos 3 meses sin fijos, con la inflación de Ajustes.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Horizonte (meses)" grupo>
            <Segmented full value={n} onChange={setN} options={[6, 12, 24, 36].map((k) => ({ id: k, label: String(k) }))} size="sm" />
          </Field>
          <Field label="Escenario" grupo>
            <div className="flex gap-2">
              <select className="input flex-1 min-w-0" value={escId} onChange={(e) => setEscId(e.target.value)}>
                <option value="base">Solo la base</option>
                {s.escenarios.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              {esc && (
                <button type="button" className="btn btn-ghost !px-3" onClick={() => setEditar(esc)} aria-label="Editar escenario">
                  <Pencil size={16} />
                </button>
              )}
              <button type="button" className="btn btn-soft !px-3" onClick={() => setEditar(ESCENARIO_VACIO())} aria-label="Nuevo escenario">
                <Plus size={17} /> <span className="hidden sm:inline">Nuevo</span>
              </button>
            </div>
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={TrendingUp} label={`Patrimonio en ${n} meses`} value={money(finAlt?.total ?? fin.total, mon)} hint={finAlt ? `Base: ${money(fin.total, mon)}` : `Hoy: ${money(base.inicial.total, mon)}`} tone={(finAlt?.total ?? fin.total) < base.inicial.total ? 'bad' : 'ok'} />
        <KPI icon={PiggyBank} label={`Ahorro en ${n} meses`} value={money(finAlt?.ahorro ?? fin.ahorro, mon)} hint={finAlt ? `Base: ${money(fin.ahorro, mon)}` : `Hoy: ${money(base.inicial.ahorro, mon)}`} tone="ok" />
        <KPI icon={CalendarRange} label="Ahorro promedio al mes" value={money(alt ? (finAlt!.ahorro - alt.inicial.ahorro) / n : ahorroMensual, mon)} hint="en fondos de ahorro" />
        <KPI icon={Flag} label="Metas que cumples" value={`${Object.values((alt ?? base).llegadaMetas).filter(Boolean).length} de ${metasF.length}`} hint={`dentro de ${n} meses`} />
      </div>

      <Card icon={TrendingUp} title="Cómo crece tu dinero" subtitle={esc ? `Línea punteada: base. Área: ${esc.nombre}.` : 'Total en cuentas y la parte que está en ahorro'}>
        <div className="h-64 -ml-2">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gProy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ok)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--ok)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v) => money(Number(v), mon)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {esc ? (
                <>
                  <Area type="monotone" dataKey="totalEsc" name={`Total, ${esc.nombre}`} stroke="var(--ok)" fill="url(#gProy)" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="total" name="Total, base" stroke="var(--muted)" strokeDasharray="5 4" dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="ahorroEsc" name={`Ahorro, ${esc.nombre}`} stroke="var(--primary)" dot={false} strokeWidth={2} />
                </>
              ) : (
                <>
                  <Area type="monotone" dataKey="total" name="Total" stroke="var(--ok)" fill="url(#gProy)" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="ahorro" name="En ahorro" stroke="var(--primary)" dot={false} strokeWidth={2} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {metasF.length > 0 && (
        <Card icon={Target} title="Cuándo llegas a cada meta" subtitle={esc ? `Comparado con ${esc.nombre}` : 'Con tus aportes actuales'} padding={false}>
          <ul className="divide-y divide-line mt-2">
            {metasF.map((f) => {
              const b = base.llegadaMetas[f.id]
              const a = alt?.llegadaMetas[f.id]
              const diff = alt && b && a ? mesesEntreSeguro(b, a) : null
              return (
                <li key={f.id} className="px-4 md:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex items-center gap-3 flex-1 min-w-[10rem]">
                    <IconBadge icon={iconoDe(f)} size="sm" color="var(--ok)" />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{f.nombre}</p>
                      {f.meta?.fecha && <p className="text-xs text-muted">Quieres llegar en {nombreMes(mesDe(f.meta.fecha)).toLowerCase()}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-bold">{b ? nombreMes(b) : `Después de ${n} meses`}</p>
                    {alt && (
                      <p className={`text-xs font-semibold ${diff === null ? 'text-muted' : diff < 0 ? 'text-ok' : diff > 0 ? 'text-warn' : 'text-muted'}`}>
                        {a ? `${esc!.nombre}: ${nombreMes(a)}` : `${esc!.nombre}: después de ${n} meses`}
                        {diff ? ` (${diff < 0 ? `${-diff} meses antes` : `${diff} meses después`})` : ''}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Card icon={Wallet} title={`Así quedarían tus cuentas en ${nombreMes(fin.mes).toLowerCase()}`} subtitle="Según los fondos que guarda cada una">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {s.cuentas.map((c) => (
            <Bloque key={c.id} k={c.nombre} v={money((alt ?? base).porCuenta[c.id] ?? 0, mon)} />
          ))}
          <Bloque k="Sin asignar" v={money((finAlt ?? fin).sinAsignar, mon)} cls={(finAlt ?? fin).sinAsignar < 0 ? 'text-bad' : ''} />
        </div>
      </Card>

      <Card title="Mes a mes" subtitle={esc ? `Con ${esc.nombre}` : 'Proyección base'} padding={false}>
        <div className="scroll-x">
          <table className="w-full min-w-[640px] mt-3">
            <thead className="border-b border-line">
              <tr>
                <Th className="pl-5 sticky left-0 bg-surface">Mes</Th>
                <Th right>Ingresos</Th>
                <Th right>Fijos</Th>
                <Th right>Variable</Th>
                <Th right>Compras</Th>
                <Th right>En ahorro</Th>
                <Th right className="pr-5">Total</Th>
              </tr>
            </thead>
            <tbody>
              {(alt ?? base).meses.map((m) => (
                <tr key={m.mes} className="border-b border-line last:border-0">
                  <Td className="pl-5 font-semibold sticky left-0 bg-surface whitespace-nowrap">{nombreMes(m.mes)}</Td>
                  <Td right className="text-ok">{money(m.ingreso, mon)}</Td>
                  <Td right>{money(m.gastoFijo, mon)}</Td>
                  <Td right>{money(m.gastoVariable, mon)}</Td>
                  <Td right>{m.compras ? money(m.compras, mon) : '—'}</Td>
                  <Td right className="text-ok">{money(m.ahorro, mon)}</Td>
                  <Td right className={`pr-5 font-bold ${m.total < 0 ? 'text-bad' : ''}`}>{money(m.total, mon)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="card overflow-hidden">
        <button className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-4 hover:bg-surface-2 transition-colors" onClick={() => setVerCategorias((v) => !v)} aria-expanded={verCategorias}>
          <span className="text-left">
            <span className="block font-bold">Gasto por categoría</span>
            <span className="block text-[13px] text-muted">Promedio de 3 meses (o presupuesto) con inflación, sin escenarios</span>
          </span>
          <motion.span animate={{ rotate: verCategorias ? 180 : 0 }}>
            <ChevronDown size={18} className="text-muted" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {verCategorias && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="scroll-x border-t border-line">
                <table className="w-full" style={{ minWidth: 420 + cats.meses.length * 96 }}>
                  <thead className="border-b border-line">
                    <tr>
                      <Th className="sticky left-0 bg-surface z-10 pl-5">Categoría</Th>
                      <Th right>Base</Th>
                      {cats.meses.map((m) => (
                        <Th key={m} right>
                          {nombreMes(m, true)}
                        </Th>
                      ))}
                      <Th right className="pr-5">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.filas.map((f) => (
                      <tr key={f.categoria.id} className="border-b border-line last:border-0">
                        <Td className="sticky left-0 bg-surface z-10 pl-5 font-semibold whitespace-nowrap">{f.categoria.nombre}</Td>
                        <Td right>{money(f.base, mon)}</Td>
                        {f.meses.map((v, i) => (
                          <Td key={i} right>
                            {money(v, mon)}
                          </Td>
                        ))}
                        <Td right className="pr-5 font-semibold">{money(f.total, mon)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <Modal open={Boolean(editar)} onClose={() => setEditar(null)} title={editar && s.escenarios.some((e) => e.id === editar.id) ? `Editar ${editar.nombre}` : 'Nuevo escenario'}>
        {editar && (
          <FormEscenario
            key={editar.id}
            e={editar}
            onClose={(id) => {
              setEditar(null)
              if (id !== undefined) setEscId(id)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function mesesEntreSeguro(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

function FormEscenario({ e, onClose }: { e: Escenario; onClose: (id?: string) => void }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const existe = s.escenarios.some((x) => x.id === e.id)
  const [nombre, setNombre] = useState(e.nombre)
  const [ingresoPct, setIngresoPct] = useState(Math.round(e.ingresoPct * 100))
  const [recortePct, setRecortePct] = useState(Math.round(e.recortePct * 100))
  const [aporteExtra, setAporteExtra] = useState(String(e.aporteExtra || ''))
  const [aporteFondoId, setAporteFondoId] = useState(e.aporteFondoId ?? s.fondos.find((f) => f.tipo === 'ahorro')?.id ?? '')
  const [compras, setCompras] = useState<CompraPlaneada[]>(e.compras)

  const guardar = () => {
    const esc: Escenario = { id: e.id, nombre: nombre.trim() || 'Escenario', ingresoPct: ingresoPct / 100, recortePct: recortePct / 100, aporteExtra: num(aporteExtra), aporteFondoId: aporteFondoId || null, compras: compras.filter((c) => c.monto > 0) }
    s.guardarEscenario(esc)
    toast(existe ? 'Escenario actualizado' : 'Escenario guardado')
    onClose(esc.id)
  }
  const eliminar = async () => {
    if (!(await confirmar(`¿Eliminar ${e.nombre}?`, { aceptar: 'Eliminar', peligro: true }))) return
    s.eliminarEscenario(e.id)
    onClose('base')
  }
  const editarCompra = (id: string, c: Partial<CompraPlaneada>) => setCompras((xs) => xs.map((x) => (x.id === id ? { ...x, ...c } : x)))

  return (
    <form
      className="space-y-5"
      onSubmit={(ev) => {
        ev.preventDefault()
        guardar()
      }}
    >
      <Field label="Nombre">
        <input className="input" value={nombre} onChange={(ev) => setNombre(ev.target.value)} placeholder="Ahorro 500 más, compro una moto…" />
      </Field>
      <Field label={`Mi ingreso cambia ${ingresoPct >= 0 ? '+' : ''}${ingresoPct}%`}>
        <input type="range" min={-30} max={50} step={5} value={ingresoPct} onChange={(ev) => setIngresoPct(Number(ev.target.value))} className="w-full" />
      </Field>
      <Field label={`Recorto mi gasto variable ${recortePct}%`}>
        <input type="range" min={0} max={50} step={5} value={recortePct} onChange={(ev) => setRecortePct(Number(ev.target.value))} className="w-full" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={`Ahorro extra al mes (${mon})`} hint="Gastas menos y lo apartas">
          <input className="input num" inputMode="decimal" value={aporteExtra} onChange={(ev) => setAporteExtra(ev.target.value)} placeholder="0" />
        </Field>
        <Field label="Va al fondo">
          <select className="input" value={aporteFondoId} onChange={(ev) => setAporteFondoId(ev.target.value)}>
            <option value="">Sin asignar</option>
            {s.fondos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-2xl border border-line p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold">Compras grandes planeadas</p>
          <button type="button" className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => setCompras((xs) => [...xs, { id: uid(), nombre: '', monto: 0, mes: mesDe(hoyISO()), fondoId: s.fondos.find((f) => f.tipo === 'ahorro')?.id ?? null }])}>
            <Plus size={15} /> Agregar
          </button>
        </div>
        {compras.length === 0 && <p className="text-xs text-muted">Por ejemplo, un celular en marzo. Verás cómo retrasa tus metas.</p>}
        {compras.map((c) => (
          <div key={c.id} className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_8.5rem_8rem_auto] gap-2 items-center">
            <input className="input !min-h-10 col-span-2 sm:col-span-1" placeholder="Qué compras" value={c.nombre} onChange={(ev) => editarCompra(c.id, { nombre: ev.target.value })} aria-label="Qué compras" />
            <input className="input !min-h-10 num" inputMode="decimal" placeholder="Monto" value={c.monto || ''} onChange={(ev) => editarCompra(c.id, { monto: num(ev.target.value) })} aria-label="Monto" />
            <input className="input !min-h-10" type="month" value={c.mes} onChange={(ev) => editarCompra(c.id, { mes: ev.target.value })} aria-label="Mes" />
            <select className="input !min-h-10 text-sm" value={c.fondoId ?? ''} onChange={(ev) => editarCompra(c.id, { fondoId: ev.target.value || null })} aria-label="Sale del fondo">
              <option value="">Sin asignar</option>
              {s.fondos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-icon text-muted hover:!text-bad justify-self-end" onClick={() => setCompras((xs) => xs.filter((x) => x.id !== c.id))} aria-label="Quitar compra">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {existe && (
        <button type="button" className="btn btn-danger w-full" onClick={eliminar}>
          <Trash2 size={16} /> Eliminar escenario
        </button>
      )}
      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <button type="button" className="btn btn-ghost sm:flex-1" onClick={() => onClose()}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary sm:flex-[2]">
          <Check size={17} /> {existe ? 'Guardar cambios' : 'Guardar y comparar'}
        </button>
      </div>
      <p className="text-xs text-muted inline-flex items-start gap-1.5">
        <Sparkles size={13} className="shrink-0 mt-px" /> Los escenarios no cambian tus datos: solo sirven para comparar.
      </p>
    </form>
  )
}

