import { useMemo } from 'react'
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { acumuladoDiario, resumenFondos, resumenMes } from '../lib/calc'
import { money, moneyShort, pct } from '../lib/format'
import { Barra, Card, Empty, EstadoPill, KPI, Td, Th, colorReal, tonoEstado } from '../components/ui'

export function Panel({ mes, oscuro, onIrA }: { mes: string; oscuro: boolean; onIrA: (v: 'cuentas' | 'analisis') => void }) {
  const s = useStore()
  const r = useMemo(() => resumenMes(s, mes), [s, mes])
  const f = useMemo(() => resumenFondos(s, mes), [s, mes])
  const diario = useMemo(() => acumuladoDiario(s, mes), [s, mes])
  const mon = s.ajustes.moneda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const colores = useMemo(() => Object.fromEntries(s.categorias.map((c) => [c.id, colorReal(c.color)])), [s.categorias, oscuro])
  const donut = r.categorias.filter((c) => c.gastado > 0).map((c) => ({ name: c.categoria.nombre, value: c.gastado, id: c.categoria.id }))
  const estadoTono = tonoEstado(r.estado)
  const ritmoHoy = r.diasTranscurridos > 0 ? (r.presupuesto / r.diasMes) * r.diasTranscurridos : 0

  return (
    <div className="space-y-4">
      {/* Resumen principal */}
      <div className="card p-4 md:p-5 bg-gradient-to-br from-primary-soft/60 to-surface">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Gasto del mes</p>
            <p className="num text-3xl md:text-4xl font-black">{money(r.gasto, mon)}</p>
            <p className="text-sm text-muted mt-1">
              de {money(r.presupuesto, mon)} presupuestados · quedan <span className={`font-semibold ${r.disponible < 0 ? 'text-bad' : 'text-ink'}`}>{money(r.disponible, mon)}</span>
            </p>
          </div>
          <div className="text-right">
            <EstadoPill estado={r.estado} />
            <p className="text-xs text-muted mt-2">
              Día {r.diasTranscurridos} de {r.diasMes}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Barra pct={r.pctUsado} tone={estadoTono} />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>{pct(r.pctUsado)} usado</span>
            <span>Ritmo esperado a hoy: {money(ritmoHoy, mon)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Proyección al cierre" value={money(r.proyeccionCierre, mon)} tone={r.proyeccionCierre > r.presupuesto ? 'bad' : 'neutral'} hint="al ritmo actual" />
        <KPI label="Ingreso del mes" value={money(r.ingreso, mon)} hint={r.ingresoRegistrado > 0 ? 'registrado' : 'configurado (sin registro)'} />
        <KPI label="Ahorro proyectado" value={money(r.ahorroProyectado, mon)} tone={r.ahorroProyectado < 0 ? 'bad' : 'ok'} hint={`Tasa ${pct(r.tasaAhorroProyectada, 1)}`} />
        <KPI label="Saldo total en cuentas" value={money(r.saldoTotalCuentas, mon)} hint={`Neto del mes ${money(f.saldoNetoMes, mon)}`} />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card title="Ritmo de gasto" subtitle="Acumulado del mes vs. ritmo del presupuesto" className="lg:col-span-3">
          <div className="h-56">
            <ResponsiveContainer>
              <ComposedChart data={diario} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => moneyShort(v, '')} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => money(Number(v), mon)} labelFormatter={(l) => `Día ${l}`} />
                <Line type="monotone" dataKey="ritmo" name="Ritmo presupuesto" stroke="var(--muted)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Area type="monotone" dataKey="acumulado" name="Gasto acumulado" stroke="var(--primary)" fill="url(#gAcum)" strokeWidth={2.5} dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Gasto por categoría" subtitle={r.categoriaMayor ? `Mayor: ${r.categoriaMayor.nombre}` : 'Sin gastos este mes'} className="lg:col-span-2">
          {donut.length === 0 ? (
            <Empty>Registra tu primer gasto con el botón +</Empty>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                      {donut.map((d) => (
                        <Cell key={d.id} fill={colores[d.id]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v), mon)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-sm space-y-1.5 flex-1 min-w-0">
                {donut
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 6)
                  .map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colores[d.id] }} />
                      <span className="truncate flex-1">{d.name}</span>
                      <span className="num text-muted">{pct(d.value / r.gasto)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="Presupuesto por categoría" subtitle="Gastado, proyección al cierre y promedio de los últimos 3 meses" padding={false}>
        <div className="scroll-x">
          <table className="w-full min-w-[640px] mt-3">
            <thead className="border-b border-line">
              <tr>
                <Th>Categoría</Th>
                <Th right>Presupuesto</Th>
                <Th right>Gastado</Th>
                <Th right>Disponible</Th>
                <Th>% usado</Th>
                <Th right>Proyección</Th>
                <Th right>Prom. 3m</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {r.categorias.map((c) => (
                <tr key={c.categoria.id} className="border-b border-line last:border-0">
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.categoria.color }} />
                      {c.categoria.nombre}
                    </span>
                  </Td>
                  <Td right>{money(c.presupuesto, mon)}</Td>
                  <Td right>{money(c.gastado, mon)}</Td>
                  <Td right className={c.disponible < 0 ? 'text-bad font-semibold' : ''}>{money(c.disponible, mon)}</Td>
                  <Td>
                    <div className="w-28">
                      <Barra pct={c.pctUsado} tone={tonoEstado(c.estado)} />
                      <span className="text-xs text-muted">{pct(c.pctUsado)}</span>
                    </div>
                  </Td>
                  <Td right>{money(c.proyeccion, mon)}</Td>
                  <Td right>{money(c.prom3m, mon)}</Td>
                  <Td>
                    <EstadoPill estado={c.estado} />
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line font-semibold">
              <tr>
                <Td>Total</Td>
                <Td right>{money(r.presupuesto, mon)}</Td>
                <Td right>{money(r.gasto, mon)}</Td>
                <Td right className={r.disponible < 0 ? 'text-bad' : ''}>{money(r.disponible, mon)}</Td>
                <Td>{pct(r.pctUsado)}</Td>
                <Td right>{money(r.proyeccionCierre, mon)}</Td>
                <Td right>{money(r.categorias.reduce((a, c) => a + c.prom3m, 0), mon)}</Td>
                <Td>
                  <EstadoPill estado={r.estado} />
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card
          title="Fondos del mes"
          subtitle={`Ingreso registrado ${money(f.ingresoMes, mon)} · neto acumulado ${money(f.saldoNetoAcumulado, mon)}`}
          action={
            <button className="text-sm text-primary font-semibold" onClick={() => onIrA('cuentas')}>
              Ver detalle
            </button>
          }
        >
          {f.filas.length === 0 ? (
            <Empty>Configura tus fondos en Ajustes</Empty>
          ) : (
            <ul className="space-y-3">
              {f.filas.map((x) => (
                <li key={x.fondo.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {x.fondo.nombre} <span className="text-muted">({Math.round(x.fondo.porcentaje * 100)}%)</span>
                    </span>
                    <span className="num">
                      {money(x.usado, mon)} / {money(x.asignado, mon)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Barra pct={x.pctUsado} tone={tonoEstado(x.estado)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title="Cómo vas"
          subtitle="Lectura rápida del mes"
          action={
            <button className="text-sm text-primary font-semibold" onClick={() => onIrA('analisis')}>
              Ver tendencias
            </button>
          }
        >
          <ul className="text-sm space-y-2">
            <Lectura ok={r.estado === 'En control'} texto={r.estado === 'En control' ? 'El gasto total va dentro del presupuesto.' : r.estado === 'En riesgo' ? 'A este ritmo superarás el presupuesto antes de fin de mes.' : 'Ya superaste el presupuesto del mes.'} />
            <Lectura ok={(r.tasaAhorroProyectada ?? 0) >= 0.2} texto={`Tasa de ahorro proyectada: ${pct(r.tasaAhorroProyectada, 1)} (meta sugerida ≥ 20%).`} />
            {r.categorias.filter((c) => c.estado !== 'En control').slice(0, 3).map((c) => (
              <Lectura key={c.categoria.id} ok={false} texto={`${c.categoria.nombre}: ${c.estado.toLowerCase()} (${pct(c.pctUsado)} del presupuesto).`} />
            ))}
            {f.filas.some((x) => x.saldoMes < 0) && <Lectura ok={false} texto="Hay fondos usados por encima de lo asignado este mes." />}
            {r.gasto === 0 && <Lectura ok texto="Aún no hay gastos este mes." />}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Lectura({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className="flex gap-2">
      <span className={ok ? 'text-ok' : 'text-warn'}>{ok ? '●' : '▲'}</span>
      <span>{texto}</span>
    </li>
  )
}
