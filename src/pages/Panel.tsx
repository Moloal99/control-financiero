import { motion } from 'motion/react'
import { ArrowDownLeft, CalendarDays, ChartPie, CircleCheck, Gauge, Landmark, PiggyBank, Plus, TrendingUp, TriangleAlert, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { acumuladoDiario, resumenFondos, resumenMes } from '../lib/calc'
import { mesActual, money, moneyShort, pct } from '../lib/format'
import { iconoDe } from '../lib/iconos'
import { AnimatedNumber, Barra, Card, Empty, EstadoPill, IconBadge, KPI, colorReal, tonoEstado } from '../components/ui'

export function Panel({ mes, oscuro, onIrA, onRegistrar }: { mes: string; oscuro: boolean; onIrA: (v: 'cuentas' | 'analisis') => void; onRegistrar: () => void }) {
  const s = useStore()
  const r = useMemo(() => resumenMes(s, mes), [s, mes])
  const f = useMemo(() => resumenFondos(s, mes), [s, mes])
  const diario = useMemo(() => acumuladoDiario(s, mes), [s, mes])
  const mon = s.ajustes.moneda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colores = useMemo(() => Object.fromEntries(s.categorias.map((c) => [c.id, colorReal(c.color)])), [s.categorias, oscuro])
  const donut = r.categorias
    .filter((c) => c.gastado > 0)
    .map((c) => ({ name: c.categoria.nombre, value: c.gastado, id: c.categoria.id }))
    .sort((a, b) => b.value - a.value)
  const fmt = (n: number) => money(n, mon)

  return (
    <div className="space-y-4 md:space-y-5">
      <Hero r={r} mes={mes} mon={mon} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={TrendingUp} label="Proyección al cierre" value={<AnimatedNumber value={r.proyeccionCierre} format={fmt} />} tone={r.proyeccionCierre > r.presupuesto ? 'bad' : 'neutral'} hint="si sigues a este ritmo" />
        <KPI icon={ArrowDownLeft} label="Ingreso del mes" value={<AnimatedNumber value={r.ingreso} format={fmt} />} hint={r.ingresoRegistrado > 0 ? 'registrado' : 'el de Ajustes (aún sin registrar)'} />
        <KPI icon={PiggyBank} label="Ahorro proyectado" value={<AnimatedNumber value={r.ahorroProyectado} format={fmt} />} tone={r.ahorroProyectado < 0 ? 'bad' : 'ok'} hint={`Tasa de ahorro ${pct(r.tasaAhorroProyectada, 1)}`} />
        <KPI icon={Landmark} label="Saldo en cuentas" value={<AnimatedNumber value={r.saldoTotalCuentas} format={fmt} />} hint={`Neto del mes ${money(f.saldoNetoMes, mon)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
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

        <Card icon={ChartPie} title="En qué se va" subtitle={r.categoriaMayor ? `Lo que más pesa: ${r.categoriaMayor.nombre}` : 'Aún no hay gastos este mes'} className="lg:col-span-2">
          {donut.length === 0 ? (
            <Empty
              icon={Wallet}
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
                  const c = s.categorias.find((x) => x.id === d.id)!
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
      </div>

      <Card title="Presupuesto por categoría" subtitle="Gastado frente a lo presupuestado, con la proyección al cierre" padding={false}>
        <ul className="divide-y divide-line mt-2">
          {r.categorias.map((c) => {
            const Icono = iconoDe(c.categoria)
            const tono = tonoEstado(c.estado)
            return (
              <li key={c.categoria.id} className="px-4 md:px-5 py-3.5 flex items-center gap-3 md:gap-4">
                <IconBadge icon={Icono} color={c.categoria.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold truncate">{c.categoria.nombre}</p>
                    <p className={`num text-sm font-bold shrink-0 ${c.disponible < 0 ? 'text-bad' : ''}`}>
                      {c.disponible < 0 ? 'Excede ' : 'Quedan '}
                      {money(Math.abs(c.disponible), mon)}
                    </p>
                  </div>
                  <div className="my-1.5">
                    <Barra pct={c.pctUsado} tone={tono} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted">
                    <span className="num truncate">
                      {money(c.gastado, mon)} de {money(c.presupuesto, mon)}
                      <span className="hidden sm:inline">
                        {'  '}| proyección {money(c.proyeccion, mon)} | promedio 3 meses {money(c.prom3m, mon)}
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
        <div className="px-4 md:px-5 py-3.5 border-t border-line bg-surface-2/60 rounded-b-[1.25rem] flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-bold">Total del mes</span>
          <span className="num text-muted">
            <b className="text-ink">{money(r.gasto, mon)}</b> de {money(r.presupuesto, mon)} ({pct(r.pctUsado)})
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          icon={Wallet}
          title="Fondos del mes"
          subtitle={`Ingreso registrado ${money(f.ingresoMes, mon)}`}
          action={
            <button className="text-sm text-primary font-bold hover:underline" onClick={() => onIrA('cuentas')}>
              Ver detalle
            </button>
          }
        >
          {f.filas.length === 0 ? (
            <Empty>Configura tus fondos en Ajustes.</Empty>
          ) : (
            <ul className="space-y-3.5">
              {f.filas.map((x) => (
                <li key={x.fondo.id} className="flex items-center gap-3">
                  <IconBadge icon={iconoDe(x.fondo)} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-semibold truncate">
                        {x.fondo.nombre} <span className="text-muted font-medium">{Math.round(x.fondo.porcentaje * 100)}%</span>
                      </span>
                      <span className="num text-muted shrink-0">
                        <b className="text-ink">{moneyShort(x.usado, mon)}</b> / {moneyShort(x.asignado, mon)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Barra pct={x.pctUsado} tone={tonoEstado(x.estado)} alto="h-1.5" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          icon={CircleCheck}
          title="Cómo vas"
          subtitle="Lectura rápida del mes"
          action={
            <button className="text-sm text-primary font-bold hover:underline" onClick={() => onIrA('analisis')}>
              Ver tendencias
            </button>
          }
        >
          <ul className="text-sm space-y-2.5">
            <Lectura ok={r.estado === 'En control'} texto={r.estado === 'En control' ? 'El gasto total va dentro del presupuesto.' : r.estado === 'En riesgo' ? 'A este ritmo superarás el presupuesto antes de fin de mes.' : 'Ya superaste el presupuesto del mes.'} />
            <Lectura ok={(r.tasaAhorroProyectada ?? 0) >= 0.2} texto={`Tasa de ahorro proyectada: ${pct(r.tasaAhorroProyectada, 1)} (la meta sugerida es 20% o más).`} />
            {r.categorias
              .filter((c) => c.estado !== 'En control')
              .slice(0, 3)
              .map((c) => (
                <Lectura key={c.categoria.id} ok={false} texto={`${c.categoria.nombre}: ${c.estado.toLowerCase()}, va en ${pct(c.pctUsado)} del presupuesto.`} />
              ))}
            {f.filas.some((x) => x.saldoMes < 0) && <Lectura ok={false} texto="Hay fondos usados por encima de lo asignado este mes." />}
            {r.gasto === 0 && <Lectura ok texto="Aún no hay gastos este mes." />}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/** Encabezado del panel: lo que queda del presupuesto y un medidor con la marca del ritmo esperado a hoy. */
function Hero({ r, mes, mon }: { r: ReturnType<typeof resumenMes>; mes: string; mon: string }) {
  const esActual = mes === mesActual()
  // En el mes en curso: cuánto se puede gastar por día hasta fin de mes (hoy incluido).
  // En meses pasados: el gasto promedio diario que hubo.
  const diasRestantes = Math.max(1, r.diasMes - r.diasTranscurridos + 1)
  const porDia = esActual ? Math.max(0, r.disponible) / diasRestantes : r.diasTranscurridos > 0 ? r.gasto / r.diasTranscurridos : 0
  const ritmoHoy = r.diasTranscurridos > 0 ? (r.presupuesto / r.diasMes) * r.diasTranscurridos : 0
  const pctGasto = r.presupuesto > 0 ? Math.min(1, r.gasto / r.presupuesto) : 0
  const pctRitmo = r.presupuesto > 0 ? Math.min(1, ritmoHoy / r.presupuesto) : 0
  const relleno = r.estado === 'Excedido' ? '#ff6b81' : r.estado === 'En riesgo' ? '#ffc23d' : '#f2a900'
  const excedido = r.disponible < 0

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] bg-rail dark:bg-[#211d5c] text-white p-5 md:p-7 shadow-[var(--shadow-lg)]">
      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-white/70 font-medium">{excedido ? 'Te pasaste del presupuesto por' : 'Te quedan para gastar'}</p>
          <p className={`num font-extrabold tracking-tight leading-none mt-2 text-[40px] md:text-[56px] ${excedido ? 'text-[#ff8fa0]' : ''}`}>
            <AnimatedNumber value={Math.abs(r.disponible)} format={(n) => money(n, mon)} desdeCero />
          </p>
          <p className="text-sm text-white/70 mt-3">
            Gastaste <b className="text-white num">{money(r.gasto, mon)}</b> de {money(r.presupuesto, mon)}
          </p>
        </div>
        <div className="flex md:flex-col items-center md:items-end gap-3">
          <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5">
            {r.estado === 'En control' ? <CircleCheck size={13} /> : <TriangleAlert size={13} />} {r.estado}
          </span>
          <span className="text-xs text-white/70 inline-flex items-center gap-1.5">
            <CalendarDays size={13} /> Día {r.diasTranscurridos} de {r.diasMes}
          </span>
        </div>
      </div>

      {/* Medidor */}
      <div className="relative mt-6">
        <div className="h-4 rounded-full bg-white/12 overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: relleno }} initial={{ width: 0 }} animate={{ width: `${pctGasto * 100}%` }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} />
        </div>
        {r.diasTranscurridos > 0 && r.presupuesto > 0 && (
          <motion.div className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-white" initial={{ left: 0, opacity: 0 }} animate={{ left: `${pctRitmo * 100}%`, opacity: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}>
            <span className={`absolute top-full mt-2 whitespace-nowrap text-[11px] text-white/75 font-medium ${pctRitmo > 0.7 ? 'right-0' : pctRitmo < 0.3 ? 'left-0' : '-translate-x-1/2'}`}>
              ritmo a hoy {moneyShort(ritmoHoy, mon)}
            </span>
          </motion.div>
        )}
      </div>

      <div className="relative mt-9 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <Stat k={esActual ? 'Puedes gastar por día' : 'Gasto promedio por día'} v={money(porDia, mon)} destacado />
        <Stat k="Usado del presupuesto" v={pct(r.pctUsado)} />
        <Stat k="Proyección al cierre" v={money(r.proyeccionCierre, mon)} className="hidden sm:block" />
      </div>
    </section>
  )
}

function Stat({ k, v, destacado = false, className = '' }: { k: string; v: string; destacado?: boolean; className?: string }) {
  return (
    <div className={`rounded-2xl px-3.5 py-2.5 ${destacado ? 'bg-accent text-[#1d1a4d]' : 'bg-white/8'} ${className}`}>
      <p className={`text-xs ${destacado ? 'text-[#1d1a4d]/75' : 'text-white/65'}`}>{k}</p>
      <p className="num font-extrabold text-base md:text-lg leading-tight mt-0.5">{v}</p>
    </div>
  )
}

function Lectura({ ok, texto }: { ok: boolean; texto: string }) {
  const Icono = ok ? CircleCheck : TriangleAlert
  return (
    <li className="flex gap-2.5">
      <Icono size={17} className={`shrink-0 mt-0.5 ${ok ? 'text-ok' : 'text-warn'}`} />
      <span>{texto}</span>
    </li>
  )
}
