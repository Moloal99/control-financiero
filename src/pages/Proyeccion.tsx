import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { proyeccion } from '../lib/calc'
import { money, moneyShort, nombreMes, pct } from '../lib/format'
import { Card, Field, KPI, Td, Th } from '../components/ui'

export function Proyeccion({ mes }: { mes: string }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const [n, setN] = useState(6)
  const [inflPct, setInflPct] = useState(String((s.ajustes.inflacionMensual * 100).toFixed(2)))
  const [ajusteIngreso, setAjusteIngreso] = useState(0) // % extra de ingreso (escenario)
  const [recorte, setRecorte] = useState(0) // % de recorte de gasto (escenario)
  const infl = (parseFloat(inflPct.replace(',', '.')) || 0) / 100

  const p = useMemo(() => proyeccion(s, mes, n, infl), [s, mes, n, infl])

  const data = p.meses.map((m, i) => {
    const gasto = p.totalPorMes[i] * (1 - recorte / 100)
    const ingreso = p.ingresoPorMes[i] * (1 + ajusteIngreso / 100)
    return { nombre: nombreMes(m, true), gasto, ingreso, ahorro: ingreso - gasto }
  })
  const ahorroTotal = data.reduce((a, d) => a + d.ahorro, 0)
  const gastoTotal = data.reduce((a, d) => a + d.gasto, 0)
  const ingresoTotal = data.reduce((a, d) => a + d.ingreso, 0)
  let acumulado = 0
  const dataAcum = data.map((d) => ({ ...d, acumulado: (acumulado += d.ahorro) }))

  return (
    <div className="space-y-4">
      <Card title="Supuestos" subtitle="Base = promedio de los últimos 3 meses por categoría (o el presupuesto si no hay historial) × (1 + inflación)ⁿ">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Horizonte (meses)">
            <select className="input" value={n} onChange={(e) => setN(Number(e.target.value))}>
              {[3, 6, 12, 24].map((k) => (
                <option key={k} value={k}>
                  {k} meses
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inflación mensual (%)" hint="Valor por defecto en Ajustes">
            <input className="input" inputMode="decimal" value={inflPct} onChange={(e) => setInflPct(e.target.value)} />
          </Field>
          <Field label={`Escenario: ingreso ${ajusteIngreso >= 0 ? '+' : ''}${ajusteIngreso}%`}>
            <input type="range" min={-30} max={50} step={5} value={ajusteIngreso} onChange={(e) => setAjusteIngreso(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </Field>
          <Field label={`Escenario: recorte de gasto ${recorte}%`}>
            <input type="range" min={0} max={50} step={5} value={recorte} onChange={(e) => setRecorte(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label={`Gasto proyectado (${n} m)`} value={money(gastoTotal, mon)} hint={`Presupuesto: ${money(p.presupuestoTotal, mon)}`} tone={gastoTotal > p.presupuestoTotal ? 'bad' : 'neutral'} />
        <KPI label={`Ingreso proyectado (${n} m)`} value={money(ingresoTotal, mon)} />
        <KPI label={`Ahorro proyectado (${n} m)`} value={money(ahorroTotal, mon)} tone={ahorroTotal < 0 ? 'bad' : 'ok'} />
        <KPI label="Tasa de ahorro proyectada" value={pct(ingresoTotal > 0 ? ahorroTotal / ingresoTotal : null, 1)} tone={ingresoTotal > 0 && ahorroTotal / ingresoTotal >= 0.2 ? 'ok' : 'warn'} />
      </div>

      <Card title="Ahorro acumulado proyectado" subtitle="Ingreso − gasto proyectado, acumulado mes a mes">
        <div className="h-60">
          <ResponsiveContainer>
            <ComposedChart data={dataAcum} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gAhorro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ok)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--ok)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v) => money(Number(v), mon)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="acumulado" name="Ahorro acumulado" stroke="var(--ok)" fill="url(#gAhorro)" strokeWidth={2.5} />
              <Line type="monotone" dataKey="gasto" name="Gasto mensual" stroke="var(--primary)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="ingreso" name="Ingreso mensual" stroke="var(--muted)" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Detalle por categoría" subtitle="Gasto proyectado por mes (sin aplicar escenarios)" padding={false}>
        <div className="scroll-x">
          <table className="w-full mt-3" style={{ minWidth: 520 + n * 90 }}>
            <thead className="border-b border-line">
              <tr>
                <Th>Categoría</Th>
                <Th right>Base</Th>
                {p.meses.map((m) => (
                  <Th key={m} right>
                    {nombreMes(m, true)}
                  </Th>
                ))}
                <Th right>Total</Th>
                <Th right>Presup.</Th>
                <Th right>Diferencia</Th>
              </tr>
            </thead>
            <tbody>
              {p.filas.map((f) => (
                <tr key={f.categoria.id} className="border-b border-line last:border-0">
                  <Td>{f.categoria.nombre}</Td>
                  <Td right>{money(f.base, mon)}</Td>
                  {f.meses.map((v, i) => (
                    <Td key={i} right>
                      {money(v, mon)}
                    </Td>
                  ))}
                  <Td right className="font-semibold">{money(f.total, mon)}</Td>
                  <Td right>{money(f.presupuesto6, mon)}</Td>
                  <Td right className={f.diferencia < 0 ? 'text-bad' : 'text-ok'}>{money(f.diferencia, mon)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line font-semibold">
              <tr>
                <Td>Total</Td>
                <Td right>{money(p.filas.reduce((a, f) => a + f.base, 0), mon)}</Td>
                {p.totalPorMes.map((v, i) => (
                  <Td key={i} right>
                    {money(v, mon)}
                  </Td>
                ))}
                <Td right>{money(p.total, mon)}</Td>
                <Td right>{money(p.presupuestoTotal, mon)}</Td>
                <Td right className={p.presupuestoTotal - p.total < 0 ? 'text-bad' : 'text-ok'}>{money(p.presupuestoTotal - p.total, mon)}</Td>
              </tr>
              <tr className="text-muted font-normal">
                <Td>Ahorro</Td>
                <Td right>—</Td>
                {p.ahorroPorMes.map((v, i) => (
                  <Td key={i} right className={v < 0 ? 'text-bad' : ''}>
                    {money(v, mon)} <span className="text-xs">({pct(p.tasaPorMes[i])})</span>
                  </Td>
                ))}
                <Td right>{money(p.ahorroPorMes.reduce((a, b) => a + b, 0), mon)}</Td>
                <Td right>—</Td>
                <Td right>—</Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
