import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { exportarDatos, useStore } from '../store'
import { cierreMes, mesInicioDatos, serieMensual, seriePatrimonio } from '../lib/calc'
import { fechaCorta, mesActual, money, moneyShort, nombreMes, pct } from '../lib/format'
import {
  ArrowDownLeft, ArrowDownRight, ArrowUpRight, CalendarCheck, CalendarClock, ChartColumn, ChartNoAxesCombined, Download, Flame, Landmark, PiggyBank, Receipt,
  Target, TrendingDown, TrendingUp, Trophy, TriangleAlert,
} from 'lucide-react'
import { iconoDe } from '../lib/iconos'
import { toast } from '../lib/feedback'
import { useUI, type SubAnalisis } from '../lib/ui'
import { Barra, Card, Dato, Empty, IconBadge, KPI, Segmented, Td, Th, colorReal } from '../components/ui'

export function Analisis({ mes, oscuro }: { mes: string; oscuro: boolean }) {
  const sub = useUI((u) => u.subAnalisis)
  const setSub = useUI((u) => u.setSubAnalisis)
  return (
    <div className="space-y-4 md:space-y-5">
      <Segmented<SubAnalisis>
        full
        className="md:!w-fit"
        value={sub}
        onChange={setSub}
        options={[
          { id: 'tendencias', label: 'Tendencias', icon: ChartColumn },
          { id: 'patrimonio', label: 'Patrimonio', icon: Landmark },
          { id: 'cierre', label: <><span className="sm:hidden">Cierre</span><span className="hidden sm:inline">Cierre de mes</span></>, icon: CalendarCheck },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {sub === 'tendencias' && <Tendencias mes={mes} oscuro={oscuro} />}
          {sub === 'patrimonio' && <Patrimonio mes={mes} />}
          {sub === 'cierre' && <Cierre mes={mes} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Tendencias({ mes, oscuro }: { mes: string; oscuro: boolean }) {
  const s = useStore()
  const [n, setN] = useState<6 | 12 | 24>(12)
  const mon = s.ajustes.moneda
  const serie = useMemo(() => serieMensual(s, mes, n), [s, mes, n])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colores = useMemo(() => Object.fromEntries(s.categorias.map((c) => [c.id, colorReal(c.color)])), [s.categorias, oscuro])

  const conDatos = serie.filter((p) => p.gasto > 0)
  const promGasto = conDatos.length ? conDatos.reduce((a, p) => a + p.gasto, 0) / conDatos.length : 0
  const promTasa = conDatos.length ? conDatos.reduce((a, p) => a + (p.tasaAhorro ?? 0), 0) / conDatos.length : null
  const mejor = conDatos.reduce<typeof serie[number] | null>((a, p) => (!a || (p.tasaAhorro ?? -1) > (a.tasaAhorro ?? -1) ? p : a), null)
  const peor = conDatos.reduce<typeof serie[number] | null>((a, p) => (!a || p.gasto > a.gasto ? p : a), null)

  // Tendencia: comparar los últimos 3 meses con datos contra los 3 anteriores
  const ult = conDatos.slice(-3)
  const ant = conDatos.slice(-6, -3)
  const tendencia = ult.length && ant.length ? ult.reduce((a, p) => a + p.gasto, 0) / ult.length / (ant.reduce((a, p) => a + p.gasto, 0) / ant.length) - 1 : null

  const dataChart = serie.map((p) => ({
    ...p,
    nombre: nombreMes(p.mes, true),
    media3: null as number | null,
  }))
  for (let i = 0; i < dataChart.length; i++) {
    const w = dataChart.slice(Math.max(0, i - 2), i + 1)
    dataChart[i].media3 = w.reduce((a, p) => a + p.gasto, 0) / w.length
  }

  const porCatTotal = s.categorias
    .map((c) => ({ c, total: serie.reduce((a, p) => a + (p.porCategoria[c.id] ?? 0), 0) }))
    .sort((a, b) => b.total - a.total)
  const totalGasto = serie.reduce((a, p) => a + p.gasto, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">Tendencias de los últimos {n} meses hasta {nombreMes(mes)}</p>
        <Segmented
          size="sm"
          value={n}
          onChange={setN}
          options={[
            { id: 6 as const, label: '6 meses' },
            { id: 12 as const, label: '12 meses' },
            { id: 24 as const, label: '24 meses' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Receipt} label="Gasto promedio mensual" value={money(promGasto, mon)} hint={`${conDatos.length} meses con datos`} />
        <KPI icon={PiggyBank} label="Tasa de ahorro promedio" value={pct(promTasa, 1)} tone={(promTasa ?? 0) >= 0.2 ? 'ok' : 'warn'} />
        <KPI
          icon={tendencia !== null && tendencia > 0 ? ArrowUpRight : ArrowDownRight}
          label="Tendencia del gasto"
          value={tendencia === null ? '—' : `${tendencia > 0 ? '+' : ''}${pct(tendencia, 1)}`}
          tone={tendencia === null ? 'neutral' : tendencia > 0.05 ? 'bad' : tendencia < -0.05 ? 'ok' : 'neutral'}
          hint="últimos 3 meses vs. 3 anteriores"
        />
        <KPI icon={Flame} label="Mes de mayor gasto" value={peor ? money(peor.gasto, mon) : '—'} hint={peor ? nombreMes(peor.mes) : undefined} />
      </div>

      <Card icon={ChartNoAxesCombined} title="Ingreso, gasto y ahorro" subtitle="Barras de ingreso y gasto, con la media móvil de 3 meses del gasto">
        {conDatos.length === 0 ? (
          <Empty icon={ChartColumn} title="Aún no hay historia">
            Cuando registres gastos de varios meses verás aquí cómo cambian. También puedes importar tu historial desde Excel.
          </Empty>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={dataChart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => money(Number(v), mon)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ingreso" name="Ingreso" fill="var(--ok)" radius={[4, 4, 0, 0]} opacity={0.75} />
                <Bar dataKey="gasto" name="Gasto" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="apartado" name="Apartado a ahorro" fill="var(--c3)" radius={[4, 4, 0, 0]} />
                <Line dataKey="media3" name="Media 3 m" stroke="var(--warn)" strokeWidth={2} dot={false} type="monotone" />
                <Line dataKey="presupuesto" name="Presupuesto" stroke="var(--muted)" strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card icon={ChartColumn} title="Gasto por categoría en el tiempo" subtitle="Apilado por mes" className="lg:col-span-3">
          {conDatos.length === 0 ? (
            <Empty>Sin datos.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={dataChart.map((p) => ({ nombre: p.nombre, ...p.porCategoria }))} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => money(Number(v), mon)} />
                  {s.categorias.map((c) => (
                    <Bar key={c.id} dataKey={c.id} name={c.nombre} stackId="a" fill={colores[c.id]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card icon={Trophy} title="Ranking de categorías" subtitle={`Total del período: ${money(totalGasto, mon)}`} className="lg:col-span-2">
          {totalGasto === 0 ? (
            <Empty>Sin datos.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {porCatTotal.map(({ c, total }) => (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      {(() => {
                        const I = iconoDe(c)
                        return <I size={16} style={{ color: c.color }} className="shrink-0" />
                      })()}
                      <span className="truncate">{c.nombre}</span>
                    </span>
                    <span className="num">
                      {money(total, mon)} <span className="text-muted">({pct(total / totalGasto)})</span>
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Barra pct={total / totalGasto} color={c.color} alto="h-1.5" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card icon={PiggyBank} title="Tasa de ahorro mensual" subtitle={mejor ? `Mejor mes: ${nombreMes(mejor.mes)} (${pct(mejor.tasaAhorro, 1)})` : undefined}>
        {conDatos.length === 0 ? (
          <Empty>Sin datos.</Empty>
        ) : (
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={dataChart.map((p) => ({ nombre: p.nombre, tasa: p.tasaAhorro === null ? 0 : p.tasaAhorro * 100 }))} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Bar dataKey="tasa" name="Tasa de ahorro" fill="var(--c2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card icon={CalendarClock} title="Mes a mes" subtitle="Resumen de cada mes del período" padding={false}>
        <ul className="md:hidden divide-y divide-line mt-2">
          {serie
            .slice()
            .reverse()
            .map((p) => (
              <li key={p.mes} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{nombreMes(p.mes)}</p>
                  <p className={`num text-sm font-bold ${p.ahorro < 0 ? 'text-bad' : 'text-ok'}`}>{pct(p.tasaAhorro, 1)}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
                  <Dato k="Ingreso" v={money(p.ingreso, mon)} />
                  <Dato k="Gasto" v={money(p.gasto, mon)} cls={p.gasto > p.presupuesto ? 'text-bad' : ''} />
                  <Dato k="Presupuesto" v={money(p.presupuesto, mon)} />
                  <Dato k="Ahorro" v={money(p.ahorro, mon)} cls={p.ahorro < 0 ? 'text-bad' : 'text-ok'} />
                </div>
              </li>
            ))}
        </ul>
        <div className="hidden md:block scroll-x">
          <table className="w-full min-w-[640px] mt-3">
            <thead className="border-b border-line">
              <tr>
                <Th className="pl-5">Mes</Th>
                <Th right>Ingreso</Th>
                <Th right>Gasto</Th>
                <Th right>Presupuesto</Th>
                <Th right>% presup.</Th>
                <Th right>Ahorro</Th>
                <Th right>Tasa</Th>
              </tr>
            </thead>
            <tbody>
              {serie
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.mes} className="border-b border-line last:border-0">
                    <Td className="pl-5 font-semibold">{nombreMes(p.mes)}</Td>
                    <Td right>{money(p.ingreso, mon)}</Td>
                    <Td right>{money(p.gasto, mon)}</Td>
                    <Td right>{money(p.presupuesto, mon)}</Td>
                    <Td right className={p.gasto > p.presupuesto ? 'text-bad' : ''}>{p.presupuesto > 0 ? pct(p.gasto / p.presupuesto) : '—'}</Td>
                    <Td right className={p.ahorro < 0 ? 'text-bad' : 'text-ok'}>{money(p.ahorro, mon)}</Td>
                    <Td right>{pct(p.tasaAhorro, 1)}</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ═════════════════════════ Patrimonio ═════════════════════════ */

function Patrimonio({ mes }: { mes: string }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const [n, setN] = useState<6 | 12 | 24>(12)
  const serie = useMemo(() => {
    const inicio = mesInicioDatos(s)
    const todos = seriePatrimonio(s, mes, n)
    const desde = todos.filter((p) => !inicio || p.mes >= inicio)
    return (desde.length ? desde : todos.slice(-1)).map((p, i, arr) => ({ ...p, nombre: nombreMes(p.mes, true), variacion: i === 0 ? 0 : p.total - arr[i - 1].total }))
  }, [s, mes, n])
  const ultimo = serie[serie.length - 1]
  const primero = serie[0]
  const variaciones = serie.slice(1).map((p) => p.variacion)
  const promedio = variaciones.length ? variaciones.reduce((a, b) => a + b, 0) / variaciones.length : 0
  const mejor = serie.slice(1).reduce<(typeof serie)[number] | null>((a, p) => (!a || p.variacion > a.variacion ? p : a), null)

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">Saldo total de tus cuentas al cierre de cada mes</p>
        <Segmented size="sm" value={n} onChange={setN} options={[6, 12, 24].map((k) => ({ id: k as 6 | 12 | 24, label: `${k} meses` }))} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Landmark} label="Patrimonio" value={money(ultimo.total, mon)} hint={nombreMes(ultimo.mes)} />
        <KPI icon={ultimo.total >= primero.total ? TrendingUp : TrendingDown} label={`Cambio desde ${primero.nombre}`} value={`${ultimo.total - primero.total >= 0 ? '+' : '−'}${money(Math.abs(ultimo.total - primero.total), mon)}`} tone={ultimo.total >= primero.total ? 'ok' : 'bad'} hint={`${serie.length} meses con datos`} />
        <KPI icon={CalendarClock} label="Crece en promedio" value={`${promedio >= 0 ? '+' : '−'}${money(Math.abs(promedio), mon)}`} hint="por mes" tone={promedio >= 0 ? 'ok' : 'bad'} />
        <KPI icon={PiggyBank} label="En ahorro" value={money(ultimo.ahorro, mon)} hint={ultimo.total > 0 ? `${pct(ultimo.ahorro / ultimo.total)} de tu patrimonio` : undefined} tone="ok" />
      </div>
      <Card icon={TrendingUp} title="Evolución" subtitle={mejor ? `Mejor mes: ${nombreMes(mejor.mes)} (+${money(mejor.variacion, mon)})` : undefined}>
        <div className="h-64 -ml-2">
          <ResponsiveContainer>
            <AreaChart data={serie} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gPat2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ok)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--ok)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v) => money(Number(v), mon)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="total" name="Total" stroke="var(--ok)" fill="url(#gPat2)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="ahorro" name="En ahorro" stroke="var(--primary)" fill="none" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Cuánto creció cada mes" subtitle="Diferencia de patrimonio contra el mes anterior">
        <div className="h-48 -ml-2">
          <ResponsiveContainer>
            <BarChart data={serie.slice(1)} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v) => money(Number(v), mon)} />
              <Bar dataKey="variacion" name="Variación" radius={[4, 4, 0, 0]} fill="var(--ok)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

/* ═════════════════════════ Cierre de mes ═════════════════════════ */

function Cierre({ mes }: { mes: string }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const c = useMemo(() => cierreMes(s, mes), [s, mes])
  const enCurso = mes === mesActual()
  const cats = s.categorias

  const exportar = async () => {
    const lib = await import('../lib/excel')
    const blob = await lib.exportarExcel(exportarDatos(s), { desde: `${mes}-01`, hasta: `${mes}-31`, titulo: `Cierre de ${nombreMes(mes)}` })
    lib.descargar(blob, `cierre-${mes}.xlsx`)
    toast('Cierre descargado', { detalle: nombreMes(mes) })
  }

  const frase =
    c.ingreso <= 0
      ? 'Aún no registraste ingresos en este mes.'
      : c.ahorroNeto >= 0
        ? `Ahorraste ${pct(c.tasaAhorro, 0)} de lo que ganaste.${c.apartado > 0 ? ` Apartaste ${money(c.apartado, mon)} para tus metas.` : ''}`
        : `Gastaste ${money(-c.ahorroNeto, mon)} más de lo que entró.`

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{enCurso ? 'Mes en curso' : 'Cierre de'}</p>
            <h2 className="text-2xl font-extrabold tracking-tight">{nombreMes(mes)}</h2>
            <p className="mt-2 text-[15px] max-w-xl">{frase}</p>
          </div>
          <button className="btn btn-ghost" onClick={exportar}>
            <Download size={17} /> Exportar el mes
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <Cifra k="Entró" v={money(c.ingreso, mon)} cls="text-ok" />
          <Cifra k="Gastaste" v={money(c.gasto, mon)} />
          <Cifra k="Te quedó" v={money(c.ahorroNeto, mon)} cls={c.ahorroNeto < 0 ? 'text-bad' : 'text-ok'} />
          <Cifra k="Patrimonio" v={`${c.variacionPatrimonio >= 0 ? '+' : '−'}${money(Math.abs(c.variacionPatrimonio), mon)}`} cls={c.variacionPatrimonio < 0 ? 'text-bad' : 'text-ok'} nota={`${money(c.patrimonioInicio, mon)} a ${money(c.patrimonioFin, mon)}`} />
        </div>
        {c.gastoVsPromedio !== null && (
          <p className={`text-sm mt-4 inline-flex items-center gap-1.5 font-semibold ${c.gastoVsPromedio > 0.05 ? 'text-warn' : c.gastoVsPromedio < -0.05 ? 'text-ok' : 'text-muted'}`}>
            {c.gastoVsPromedio > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            Gastaste {pct(Math.abs(c.gastoVsPromedio), 0)} {c.gastoVsPromedio > 0 ? 'más' : 'menos'} que tu promedio de los 3 meses anteriores
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card icon={Target} title="Tus metas este mes" subtitle={c.metas.length ? `${money(c.metas.reduce((a, m) => a + m.aporte, 0), mon)} aportados` : undefined}>
          {c.metas.length === 0 ? (
            <Empty>No tienes metas todavía.</Empty>
          ) : (
            <ul className="space-y-3.5">
              {c.metas.map((m) => (
                <li key={m.fondo.id} className="flex items-center gap-3">
                  <IconBadge icon={iconoDe(m.fondo)} size="sm" color="var(--ok)" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-semibold truncate">{m.fondo.nombre}</span>
                      <span className={`num font-bold shrink-0 ${m.aporte < 0 ? 'text-bad' : 'text-ok'}`}>
                        {m.aporte >= 0 ? '+' : ''}
                        {money(m.aporte, mon)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Barra pct={m.objetivo > 0 ? m.despues / m.objetivo : 0} tone="ok" alto="h-1.5" />
                    </div>
                    <p className="text-xs text-muted mt-1 num">
                      {money(m.antes, mon)} a {money(m.despues, mon)} de {money(m.objetivo, mon)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card icon={TriangleAlert} title="Categorías que se pasaron" subtitle={c.excedidas.length ? `${c.excedidas.length} de ${cats.length}` : 'Ninguna'}>
          {c.excedidas.length === 0 ? (
            <Empty>Todas las categorías quedaron dentro del presupuesto.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {c.excedidas.map((x) => {
                const I = iconoDe(x.categoria)
                return (
                  <li key={x.categoria.id} className="flex items-center gap-2.5 text-sm">
                    <I size={16} style={{ color: x.categoria.color }} className="shrink-0" />
                    <span className="flex-1 truncate">{x.categoria.nombre}</span>
                    <span className="num text-bad font-bold">+{money(-x.disponible, mon)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card icon={Receipt} title="Gastos más grandes">
          {c.topGastos.length === 0 ? (
            <Empty>Sin gastos este mes.</Empty>
          ) : (
            <ul className="divide-y divide-line -my-1">
              {c.topGastos.map((g) => {
                const cat = cats.find((x) => x.id === g.categoriaId)
                return (
                  <li key={g.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{g.descripcion || cat?.nombre || 'Gasto'}</p>
                      <p className="text-xs text-muted">
                        {fechaCorta(g.fecha)}, {cat?.nombre ?? 'Sin categoría'}
                      </p>
                    </div>
                    <span className="num font-bold text-sm">{money(g.monto, mon)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card icon={CalendarClock} title="Gastos fijos" subtitle={c.fijos.total ? `${money(c.fijos.total, mon)} en el mes` : 'Sin fijos registrados'}>
          <div className="grid grid-cols-2 gap-3">
            <Cifra k="Pagados" v={money(c.fijos.total - c.fijos.pendiente, mon)} />
            <Cifra k="Pendientes" v={money(c.fijos.pendiente, mon)} cls={c.fijos.pendiente > 0 ? 'text-warn' : ''} />
          </div>
          <p className="text-xs text-muted mt-3 inline-flex items-center gap-1.5">
            <ArrowDownLeft size={13} /> Los fijos se administran en Plan.
          </p>
        </Card>
      </div>
    </div>
  )
}

function Cifra({ k, v, cls = '', nota }: { k: string; v: string; cls?: string; nota?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3 min-w-0">
      <p className="text-xs text-muted">{k}</p>
      <p className={`num font-extrabold text-lg truncate ${cls}`}>{v}</p>
      {nota && <p className="text-[11px] text-muted num truncate">{nota}</p>}
    </div>
  )
}
