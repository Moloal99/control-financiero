import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownLeft, ArrowRight, CalendarClock, ShoppingBag, CalendarDays, ChartPie, Check, CircleCheck, Gauge, Inbox, PiggyBank, Plus, Sparkles, Target, TrendingUp, TriangleAlert, Wallet, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore, CLAVE_AVISO_MIGRACION } from '../store'
import { CATEGORIA_SIN, acumuladoDiario, mesInicioDatos, metas as calcularMetas, ocurrenciasPendientes, puedesGastar, resumenFondos, resumenMes, seriePatrimonio, type Alerta } from '../lib/calc'
import type { InformeMigracion as Informe } from '../lib/migrar'
import { registrarFijo, registrarFijoConCambios } from '../lib/acciones'
import { hoyISO, mesActual, money, moneyShort, nombreMes, pct } from '../lib/format'
import { iconoDe } from '../lib/iconos'
import { irA, useUI } from '../lib/ui'
import { ListaAlertas } from '../components/Alertas'
import { AnimatedNumber, Barra, BarraHitos, Card, Empty, EstadoPill, IconBadge, colorReal, tonoEstado } from '../components/ui'

export function Inicio({ oscuro, alertas, onDescartar }: { oscuro: boolean; alertas: Alerta[]; onDescartar: (id: string) => void }) {
  const s = useStore()
  const mes = mesActual()
  const hoy = hoyISO()
  const mon = s.ajustes.moneda
  const pg = useMemo(() => puedesGastar(s, hoy), [s, hoy])
  const f = useMemo(() => resumenFondos(s, mes), [s, mes])
  const r = useMemo(() => resumenMes(s, mes), [s, mes])
  const listaMetas = useMemo(() => calcularMetas(s, hoy), [s, hoy])
  const pendientes = useMemo(() => ocurrenciasPendientes(s, hoy).filter((o) => o.mes === mes || o.vencida), [s, hoy, mes])
  const abrirRegistro = useUI((u) => u.abrirRegistro)

  return (
    <div className="space-y-4 md:space-y-5">
      <AvisoMigracion />
      <Hero pg={pg} ahorro={f.ahorroTotal} total={f.saldoTotalCuentas} sinAsignar={f.sinAsignar} mon={mon} />
      <AccionesRapidas />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          icon={Target}
          title="Tus metas"
          subtitle={listaMetas.length ? `${listaMetas.filter((m) => m.estado === 'cumplida').length} de ${listaMetas.length} cumplidas` : 'Ahorra con un objetivo y una fecha'}
          action={
            <button className="text-sm text-primary font-bold hover:underline" onClick={() => irA('metas')}>
              Ver todas
            </button>
          }
        >
          {listaMetas.length === 0 ? (
            <Empty
              icon={Target}
              title="Aún no tienes metas"
              action={
                <button className="btn btn-primary" onClick={() => irA('metas')}>
                  <Plus size={18} /> Crear una meta
                </button>
              }
            >
              Un viaje, un fondo de emergencia, una compra grande. La app te dice cuánto apartar cada mes.
            </Empty>
          ) : (
            <ul className="space-y-4">
              {listaMetas.slice(0, 4).map((m) => (
                <li key={m.fondo.id}>
                  <button className="w-full text-left" onClick={() => irA('metas')}>
                    <div className="flex items-center gap-3">
                      <IconBadge icon={iconoDe(m.fondo)} size="sm" color={m.estado === 'atrasada' ? 'var(--warn)' : 'var(--ok)'} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-semibold truncate">{m.fondo.nombre}</p>
                          <p className="num text-sm font-bold shrink-0">{Math.round(m.pct * 100)}%</p>
                        </div>
                        <p className="text-xs text-muted truncate">
                          {money(m.actual, mon)} de {money(m.objetivo, mon)}
                          {m.estado === 'cumplida' ? '' : m.fechaEstimada ? `, llegas en ${nombreMes(m.fechaEstimada, true)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pl-11">
                      <BarraHitos pct={m.pct} color={m.estado === 'atrasada' ? 'var(--warn)' : 'var(--ok)'} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {listaMetas.some((m) => m.faltaEsteMes > 0.5) && (
            <button className="btn btn-soft w-full mt-4" onClick={() => useUI.getState().abrirPagate()}>
              <PiggyBank size={17} /> Apartar lo de este mes
            </button>
          )}
        </Card>

        <Card icon={TriangleAlert} title="Avisos" subtitle={alertas.length ? `${alertas.length} por revisar` : 'Nada pendiente'} action={alertas.length > 3 ? <button className="text-sm text-primary font-bold hover:underline" onClick={() => useUI.getState().setAlertas(true)}>Ver todos</button> : undefined}>
          <ListaAlertas alertas={alertas} onDescartar={onDescartar} max={3} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PresupuestoMes r={r} mon={mon} />
        <Card
          icon={CalendarClock}
          title="Fijos de este mes"
          subtitle={s.recurrentes.some((x) => x.activo) ? (pendientes.length ? `${pendientes.length} por marcar. Toca el monto si cambió.` : 'Todo al día') : 'Alquiler, internet, sueldo…'}
          action={
            <button className="text-sm text-primary font-bold hover:underline" onClick={() => irA('plan', 'fijos')}>
              {s.recurrentes.length ? 'Ver todos' : 'Agregar'}
            </button>
          }
        >
          {!s.recurrentes.some((x) => x.activo) ? (
            <Empty icon={CalendarClock} title="Sin gastos fijos" action={<button className="btn btn-ghost" onClick={() => irA('plan', 'fijos')}><Plus size={17} /> Agregar fijos</button>}>
              Anótalos una vez y cada mes aparecen aquí para marcarlos como pagados con un toque.
            </Empty>
          ) : pendientes.length === 0 ? (
            <Empty icon={CircleCheck} title="Todo registrado">Ya anotaste todos los fijos de {nombreMes(mes).toLowerCase()}.</Empty>
          ) : (
            <ul className="divide-y divide-line -my-1">
              <AnimatePresence initial={false}>
                {pendientes.slice(0, 5).map((o) => (
                  <motion.li key={o.recurrente.id + o.mes} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{o.recurrente.nombre}</p>
                      <p className={`text-xs ${o.vencida ? 'text-warn font-semibold' : 'text-muted'}`}>
                        {o.vencida ? 'Venció el' : 'Vence el'} {Number(o.fecha.slice(8, 10))} de {nombreMes(o.mes).split(' ')[0].toLowerCase()}
                      </p>
                    </div>
                    <button className={`num font-bold text-sm underline decoration-dotted underline-offset-4 decoration-muted/60 ${o.recurrente.tipo === 'ingreso' ? 'text-ok' : ''}`} onClick={() => registrarFijoConCambios(o.recurrente, o.fecha)} title="Registrar con otro monto">
                      {money(o.recurrente.monto, mon)}
                    </button>
                    <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => registrarFijo(o.recurrente, o.fecha)}>
                      <Check size={15} /> {o.recurrente.tipo === 'gasto' ? 'Pagado' : 'Cobrado'}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <RitmoGasto mes={mes} mon={mon} />
        <EnQueSeVa r={r} oscuro={oscuro} mon={mon} onRegistrar={() => abrirRegistro()} />
      </div>

      <Patrimonio mes={mes} mon={mon} />
    </div>
  )
}

/* ───────────────────────── Encabezado ───────────────────────── */

function Hero({ pg, ahorro, total, sinAsignar, mon }: { pg: ReturnType<typeof puedesGastar>; ahorro: number; total: number; sinAsignar: number; mon: string }) {
  const negativo = pg.disponible < 0
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] bg-rail dark:bg-[#211d5c] text-white p-5 md:p-7 shadow-[var(--shadow-lg)]">
      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-white/70 font-medium">{negativo ? 'Gastaste más de lo que tenías para gastar' : 'Puedes gastar sin tocar tus ahorros'}</p>
          <p className={`num font-extrabold tracking-tight leading-none mt-2 text-[40px] md:text-[56px] ${negativo ? 'text-[#ff8fa0]' : ''}`}>
            <AnimatedNumber value={Math.abs(pg.disponible)} format={(n) => money(n, mon)} desdeCero />
          </p>
          <p className="text-sm text-white/70 mt-3 leading-relaxed">
            {pg.segunPresupuesto ? (
              <>Lo que queda de tu presupuesto. Crea fondos de gasto en Ajustes para un cálculo exacto.</>
            ) : (
              <>
                En tus fondos de gasto hay <b className="text-white num">{money(pg.enFondosDeGasto, mon)}</b>
                {pg.fijosPendientes > 0 && (
                  <>
                    {' '}y faltan pagar <b className="text-white num">{money(pg.fijosPendientes, mon)}</b> de fijos
                  </>
                )}
                .
              </>
            )}
          </p>
        </div>
        <span className="text-xs text-white/70 inline-flex items-center gap-1.5">
          <CalendarDays size={13} /> {pg.diasRestantes === 1 ? 'Último día del mes' : `Quedan ${pg.diasRestantes} días`}
        </span>
      </div>

      <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm">
        <Stat k="Por día" v={money(pg.porDia, mon)} destacado />
        <Stat k="Ahorrado" v={money(ahorro, mon)} onClick={() => irA('metas')} />
        <Stat k="En tus cuentas" v={money(total, mon)} onClick={() => irA('cuentas')} />
        <Stat
          k="Sin asignar"
          v={money(sinAsignar, mon)}
          alerta={Math.abs(sinAsignar) > 1}
          onClick={() => (sinAsignar > 1 ? useUI.getState().abrirRegistro({ pestana: 'mover', preset: { fondoOrigenId: null } }) : irA('cuentas'))}
        />
      </div>
    </section>
  )
}

function Stat({ k, v, destacado = false, alerta = false, onClick }: { k: string; v: string; destacado?: boolean; alerta?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`text-left rounded-2xl px-3.5 py-2.5 min-w-0 transition-colors ${destacado ? 'bg-accent text-[#1d1a4d]' : 'bg-white/8 hover:bg-white/12'}`}>
      <p className={`text-xs inline-flex items-center gap-1 ${destacado ? 'text-[#1d1a4d]/75' : 'text-white/65'}`}>
        {k}
        {alerta && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </p>
      <p className="num font-extrabold text-base md:text-lg leading-tight mt-0.5 truncate">{v}</p>
    </Tag>
  )
}

/* ───────────────────────── Acciones rápidas ───────────────────────── */

function AccionesRapidas() {
  const abrir = useUI((u) => u.abrirRegistro)
  const acciones = [
    { k: 'Gasto', d: 'Anotar lo que gastaste', icono: ShoppingBag, color: 'var(--primary)', onClick: () => abrir({ pestana: 'gasto' }) },
    { k: 'Ingreso', d: 'Sueldo u otro ingreso', icono: ArrowDownLeft, color: 'var(--ok)', onClick: () => abrir({ pestana: 'ingreso' }) },
    { k: 'Ahorrar', d: 'Apartar para una meta', icono: PiggyBank, color: 'var(--accent)', onClick: () => abrir({ pestana: 'mover' }) },
  ]
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {acciones.map((a) => (
        <motion.button key={a.k} whileTap={{ scale: 0.97 }} onClick={a.onClick} className="card p-3 md:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 text-center sm:text-left hover:bg-surface-2 transition-colors">
          <IconBadge icon={a.icono} color={a.color} />
          <span className="min-w-0">
            <span className="block font-bold text-sm">{a.k}</span>
            <span className="hidden sm:block text-xs text-muted truncate">{a.d}</span>
          </span>
        </motion.button>
      ))}
    </div>
  )
}

/* ───────────────────────── Aviso de actualización ───────────────────────── */

function leerInforme(): Informe | null {
  try {
    const t = localStorage.getItem(CLAVE_AVISO_MIGRACION)
    return t ? (JSON.parse(t) as Informe) : null
  } catch {
    return null
  }
}

function AvisoMigracion() {
  const [informe, setInforme] = useState<Informe | null>(leerInforme)
  const mon = useStore((s) => s.ajustes.moneda)
  if (!informe) return null
  const cerrar = () => {
    try {
      localStorage.removeItem(CLAVE_AVISO_MIGRACION)
    } catch {
      /* sin almacenamiento */
    }
    setInforme(null)
  }
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-5 border-primary/40 bg-primary-soft/40">
      <div className="flex items-start gap-3">
        <IconBadge icon={Sparkles} />
        <div className="flex-1 min-w-0">
          <p className="font-bold">Tu app ahora está pensada para ahorrar</p>
          <ul className="text-sm text-muted mt-1.5 space-y-1 leading-snug list-disc pl-4">
            {informe.convertidos > 0 && (
              <li>
                Tus {informe.convertidos} registros de ahorro ({money(informe.montoConvertido, mon)}) ahora son aportes al fondo {informe.fondoAhorro}. Ya no cuentan como gasto y tus cuentas los reflejan.
              </li>
            )}
            <li>Los fondos guardan su saldo de un mes a otro. Reparte en Cuentas el dinero que ya tenías.</li>
            <li>Al registrar un ingreso eliges si se reparte entre tus fondos o no.</li>
          </ul>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn btn-primary !min-h-10" onClick={() => { cerrar(); irA('cuentas') }}>
              Revisar mis fondos <ArrowRight size={16} />
            </button>
            <button className="btn btn-ghost !min-h-10" onClick={cerrar}>
              Entendido
            </button>
          </div>
          <p className="text-xs text-muted mt-2">Si algo no cuadra, en Importar y exportar puedes volver a como estaban tus datos antes de esta actualización.</p>
        </div>
        <button className="btn btn-icon text-muted -mt-1 -mr-1" onClick={cerrar} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
    </motion.div>
  )
}

/* ───────────────────────── Presupuesto ───────────────────────── */

function PresupuestoMes({ r, mon }: { r: ReturnType<typeof resumenMes>; mon: string }) {
  const pctRitmo = r.presupuesto > 0 && r.diasTranscurridos > 0 ? Math.min(1, ((r.presupuesto / r.diasMes) * r.diasTranscurridos) / r.presupuesto) : 0
  const riesgo = r.categorias.filter((c) => c.estado !== 'En control').slice(0, 3)
  return (
    <Card
      icon={Wallet}
      title={`Presupuesto de ${nombreMes(r.mes).split(' ')[0].toLowerCase()}`}
      subtitle={`${money(r.gasto, mon)} de ${money(r.presupuesto, mon)}`}
      action={<EstadoPill estado={r.estado} />}
    >
      <div className="relative">
        <Barra pct={r.pctUsado} tone={tonoEstado(r.estado)} alto="h-3" />
        {pctRitmo > 0 && <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink/70" style={{ left: `${pctRitmo * 100}%` }} title="Ritmo esperado a hoy" />}
      </div>
      <div className="flex justify-between text-xs text-muted mt-1.5">
        <span>{pct(r.pctUsado)} usado</span>
        <span>{r.disponible >= 0 ? `Quedan ${money(r.disponible, mon)}` : `Excedido ${money(-r.disponible, mon)}`}</span>
      </div>
      {riesgo.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {riesgo.map((c) => (
            <li key={c.categoria.id} className="flex items-center gap-2.5 text-sm">
              {(() => {
                const I = iconoDe(c.categoria)
                return <I size={16} style={{ color: c.categoria.color }} className="shrink-0" />
              })()}
              <span className="flex-1 truncate">{c.categoria.nombre}</span>
              <span className={`num font-semibold ${c.estado === 'Excedido' ? 'text-bad' : 'text-warn'}`}>{pct(c.pctUsado)}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="text-sm text-primary font-bold hover:underline mt-4 inline-flex items-center gap-1" onClick={() => irA('plan', 'presupuesto')}>
        Ver presupuesto por categoría <ArrowRight size={14} />
      </button>
    </Card>
  )
}

/* ───────────────────────── Gráficos ───────────────────────── */

function RitmoGasto({ mes, mon }: { mes: string; mon: string }) {
  const s = useStore()
  const diario = useMemo(() => acumuladoDiario(s, mes), [s, mes])
  return (
    <Card icon={Gauge} title="Ritmo de gasto" subtitle="Lo gastado día a día frente al ritmo del presupuesto" className="lg:col-span-3">
      <div className="h-56 -ml-2">
        <ResponsiveContainer>
          <ComposedChart data={diario} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="gAcum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="dia" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v) => money(Number(v), mon)} labelFormatter={(l) => `Día ${l}`} />
            <Line type="monotone" dataKey="ritmo" name="Ritmo del presupuesto" stroke="var(--muted)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
            <Area type="monotone" dataKey="acumulado" name="Gastado" stroke="var(--primary)" fill="url(#gAcum)" strokeWidth={2.5} dot={false} connectNulls={false} animationDuration={900} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function EnQueSeVa({ r, oscuro, mon, onRegistrar }: { r: ReturnType<typeof resumenMes>; oscuro: boolean; mon: string; onRegistrar: () => void }) {
  const categorias = useStore((s) => s.categorias)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colores = useMemo(() => Object.fromEntries([...categorias, CATEGORIA_SIN].map((c) => [c.id, colorReal(c.color)])), [categorias, oscuro])
  const donut = r.categorias
    .filter((c) => c.gastado > 0)
    .map((c) => ({ name: c.categoria.nombre, value: c.gastado, id: c.categoria.id }))
    .sort((a, b) => b.value - a.value)
  return (
    <Card icon={ChartPie} title="En qué se va" subtitle={r.categoriaMayor ? `Lo que más pesa: ${r.categoriaMayor.nombre}` : 'Aún no hay gastos este mes'} className="lg:col-span-2">
      {donut.length === 0 ? (
        <Empty
          icon={Inbox}
          title="Mes sin gastos"
          action={
            <button className="btn btn-primary" onClick={onRegistrar}>
              <Plus size={18} /> Registrar gasto
            </button>
          }
        >
          Registra tu primer gasto y aquí verás cómo se reparte.
        </Empty>
      ) : (
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} cornerRadius={4} stroke="none" animationDuration={700}>
                  {donut.map((d) => (
                    <Cell key={d.id} fill={colores[d.id]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v), mon)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
              <div>
                <p className="text-[11px] text-muted leading-none">Total</p>
                <p className="num font-extrabold text-sm mt-1">{moneyShort(r.gasto, mon)}</p>
              </div>
            </div>
          </div>
          <ul className="text-sm space-y-2 flex-1 min-w-0 w-full">
            {donut.slice(0, 6).map((d) => {
              const c = categorias.find((x) => x.id === d.id) ?? CATEGORIA_SIN
              const Icono = iconoDe(c)
              return (
                <li key={d.id} className="flex items-center gap-2.5">
                  <Icono size={16} style={{ color: colores[d.id] }} className="shrink-0" />
                  <span className="truncate flex-1">{d.name}</span>
                  <span className="num font-semibold">{pct(d.value / r.gasto)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Patrimonio({ mes, mon }: { mes: string; mon: string }) {
  const s = useStore()
  const serie = useMemo(() => {
    const inicio = mesInicioDatos(s)
    const todos = seriePatrimonio(s, mes, 12).map((p) => ({ ...p, nombre: nombreMes(p.mes, true) }))
    const desde = todos.filter((p) => !inicio || p.mes >= inicio)
    return desde.length ? desde : todos.slice(-1)
  }, [s, mes])
  const primero = serie[0]
  const ultimo = serie[serie.length - 1]
  const variacion = ultimo.total - primero.total
  return (
    <Card
      icon={TrendingUp}
      title="Tu patrimonio"
      subtitle={`${money(ultimo.total, mon)} hoy, ${variacion >= 0 ? '+' : '−'}${money(Math.abs(variacion), mon)} desde ${primero.nombre}`}
      action={
        <button className="text-sm text-primary font-bold hover:underline" onClick={() => irA('analisis', 'patrimonio')}>
          Ver detalle
        </button>
      }
    >
      <div className="h-36 -ml-2">
        <ResponsiveContainer>
          <AreaChart data={serie} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id="gPat" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ok)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--ok)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
            <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v) => money(Number(v), mon)} />
            <Area type="monotone" dataKey="total" name="Total" stroke="var(--ok)" fill="url(#gPat)" strokeWidth={2.5} dot={false} />
            <Area type="monotone" dataKey="ahorro" name="En ahorro" stroke="var(--primary)" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
