import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { serieMensual } from '../lib/calc'
import { money, moneyShort, nombreMes, pct } from '../lib/format'
import { Card, Empty, KPI, Td, Th, colorReal } from '../components/ui'

export function Analisis({ mes, oscuro }: { mes: string; oscuro: boolean }) {
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
        <div className="flex gap-1 p-1 rounded-xl bg-surface-2">
          {([6, 12, 24] as const).map((k) => (
            <button key={k} onClick={() => setN(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${n === k ? 'bg-surface shadow text-primary' : 'text-muted'}`}>
              {k} m
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Gasto promedio mensual" value={money(promGasto, mon)} hint={`${conDatos.length} meses con datos`} />
        <KPI label="Tasa de ahorro promedio" value={pct(promTasa, 1)} tone={(promTasa ?? 0) >= 0.2 ? 'ok' : 'warn'} />
        <KPI
          label="Tendencia del gasto"
          value={tendencia === null ? '—' : `${tendencia > 0 ? '+' : ''}${pct(tendencia, 1)}`}
          tone={tendencia === null ? 'neutral' : tendencia > 0.05 ? 'bad' : tendencia < -0.05 ? 'ok' : 'neutral'}
          hint="últimos 3 meses vs. 3 anteriores"
        />
        <KPI label="Mes de mayor gasto" value={peor ? money(peor.gasto, mon) : '—'} hint={peor ? nombreMes(peor.mes) : undefined} />
      </div>

      <Card title="Ingreso, gasto y ahorro" subtitle="Barras: ingreso y gasto · línea: media móvil de 3 meses del gasto">
        {conDatos.length === 0 ? (
          <Empty>Todavía no hay gastos registrados en este período.</Empty>
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
                <Line dataKey="media3" name="Media 3 m" stroke="var(--warn)" strokeWidth={2} dot={false} type="monotone" />
                <Line dataKey="presupuesto" name="Presupuesto" stroke="var(--muted)" strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card title="Gasto por categoría en el tiempo" subtitle="Apilado por mes" className="lg:col-span-3">
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
        <Card title="Ranking de categorías" subtitle={`Total del período: ${money(totalGasto, mon)}`} className="lg:col-span-2">
          {totalGasto === 0 ? (
            <Empty>Sin datos.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {porCatTotal.map(({ c, total }) => (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      {c.nombre}
                    </span>
                    <span className="num">
                      {money(total, mon)} <span className="text-muted">({pct(total / totalGasto)})</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(total / totalGasto) * 100}%`, background: c.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Tasa de ahorro mensual" subtitle={mejor ? `Mejor mes: ${nombreMes(mejor.mes)} (${pct(mejor.tasaAhorro, 1)})` : undefined}>
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

      <Card title="Tabla mensual" subtitle="Resumen por mes" padding={false}>
        <div className="scroll-x">
          <table className="w-full min-w-[640px] mt-3">
            <thead className="border-b border-line">
              <tr>
                <Th>Mes</Th>
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
                    <Td>{nombreMes(p.mes)}</Td>
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
