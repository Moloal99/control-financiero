import { useMemo } from 'react'
import { useStore } from '../store'
import { distribucionCuentas, resumenFondos, saldosCuentas } from '../lib/calc'
import { money, pct } from '../lib/format'
import { Barra, Card, Empty, EstadoPill, KPI, Td, Th, tonoEstado } from '../components/ui'

export function Cuentas({ mes }: { mes: string }) {
  const s = useStore()
  const saldos = useMemo(() => saldosCuentas(s), [s])
  const f = useMemo(() => resumenFondos(s, mes), [s, mes])
  const dist = useMemo(() => distribucionCuentas(s, mes), [s, mes])
  const mon = s.ajustes.moneda
  const total = saldos.reduce((a, c) => a + c.saldoActual, 0)
  const pctOk = Math.abs(f.totalPct - 1) < 0.0001

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Saldo total en cuentas" value={money(total, mon)} />
        <KPI label="Ingreso registrado del mes" value={money(f.ingresoMes, mon)} />
        <KPI label="Saldo efectivo neto del mes" value={money(f.saldoNetoMes, mon)} tone={f.saldoNetoMes < 0 ? 'bad' : 'ok'} hint="asignado − usado (fondos en neto)" />
        <KPI label="Neto acumulado" value={money(f.saldoNetoAcumulado, mon)} hint={`Emergencias ${money(f.emergenciasAcumulado, mon)}`} />
      </div>

      <Card title="Cuentas y saldos" subtitle="Saldo inicial + ingresos − gastos + transferencias recibidas − enviadas, desde la fecha del saldo">
        {saldos.length === 0 ? (
          <Empty>Agrega cuentas en Ajustes.</Empty>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {saldos.map((c) => (
              <div key={c.cuenta.id} className="rounded-xl border border-line p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{c.cuenta.nombre}</p>
                    <p className="text-xs text-muted">
                      {c.cuenta.tipo}
                      {c.fondos.length > 0 && ` · ${c.fondos.map((x) => x.nombre).join(', ')}`}
                    </p>
                  </div>
                  <p className={`num font-bold text-lg ${c.saldoActual < 0 ? 'text-bad' : ''}`}>{money(c.saldoActual, mon)}</p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 text-xs mt-2 text-muted">
                  <dt>Saldo inicial</dt>
                  <dd className="num text-right text-ink">{money(c.saldoInicial, mon)}</dd>
                  <dt>Ingresos</dt>
                  <dd className="num text-right text-ok">+{money(c.ingresos, mon)}</dd>
                  <dt>Gastos</dt>
                  <dd className="num text-right text-bad">-{money(c.gastos, mon)}</dd>
                  <dt>Transf. recibidas</dt>
                  <dd className="num text-right text-ink">+{money(c.transfRecibidas, mon)}</dd>
                  <dt>Transf. enviadas</dt>
                  <dd className="num text-right text-ink">-{money(c.transfEnviadas, mon)}</dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Distribución del ingreso por fondos" subtitle={pctOk ? '✔ La distribución suma 100%' : `⚠ La distribución suma ${pct(f.totalPct, 1)}; ajústala en Ajustes`} padding={false}>
        <div className="scroll-x">
          <table className="w-full min-w-[720px] mt-3">
            <thead className="border-b border-line">
              <tr>
                <Th>Fondo</Th>
                <Th right>%</Th>
                <Th right>Asignado (mes)</Th>
                <Th right>Usado (mes)</Th>
                <Th>% usado</Th>
                <Th right>Saldo del mes</Th>
                <Th>Estado</Th>
                <Th right>Saldo acumulado</Th>
                <Th>Cuenta</Th>
                <Th right>Saldo cuenta</Th>
              </tr>
            </thead>
            <tbody>
              {f.filas.map((x) => (
                <tr key={x.fondo.id} className="border-b border-line last:border-0">
                  <Td>
                    {x.fondo.nombre}
                    {!x.fondo.enSaldoNeto && <span className="text-xs text-muted"> (fuera del neto)</span>}
                  </Td>
                  <Td right>{pct(x.fondo.porcentaje)}</Td>
                  <Td right>{money(x.asignado, mon)}</Td>
                  <Td right>{money(x.usado, mon)}</Td>
                  <Td>
                    <div className="w-24">
                      <Barra pct={x.pctUsado} tone={tonoEstado(x.estado)} />
                    </div>
                  </Td>
                  <Td right className={x.saldoMes < 0 ? 'text-bad font-semibold' : ''}>{money(x.saldoMes, mon)}</Td>
                  <Td>
                    <EstadoPill estado={x.estado} />
                  </Td>
                  <Td right className={x.saldoAcumulado < 0 ? 'text-bad' : ''}>{money(x.saldoAcumulado, mon)}</Td>
                  <Td>{x.cuenta?.nombre ?? '—'}</Td>
                  <Td right>{money(x.saldoCuenta, mon)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="¿Cuánto debe recibir cada cuenta este mes?" subtitle="Pendiente positivo = falta transferir a esa cuenta; negativo = tiene de más y debe enviar" padding={false}>
        <div className="scroll-x">
          <table className="w-full min-w-[560px] mt-3">
            <thead className="border-b border-line">
              <tr>
                <Th>Cuenta</Th>
                <Th>Fondos que guarda</Th>
                <Th right>Debe recibir</Th>
                <Th right>Recibió neto</Th>
                <Th right>Pendiente</Th>
                <Th right>Saldo actual</Th>
              </tr>
            </thead>
            <tbody>
              {dist.map((x) => (
                <tr key={x.cuenta.id} className="border-b border-line last:border-0">
                  <Td>{x.cuenta.nombre}</Td>
                  <Td className="text-muted">{x.fondos.map((f) => f.nombre).join(', ') || '—'}</Td>
                  <Td right>{money(x.debeRecibir, mon)}</Td>
                  <Td right>{money(x.recibioNeto, mon)}</Td>
                  <Td right className={Math.abs(x.pendiente) > 0.005 ? (x.pendiente > 0 ? 'text-warn font-semibold' : 'text-primary font-semibold') : ''}>
                    {money(x.pendiente, mon)}
                  </Td>
                  <Td right>{money(x.saldoActual, mon)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
