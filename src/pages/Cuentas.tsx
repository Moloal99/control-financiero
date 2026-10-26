import { ArrowDownLeft, ArrowRightLeft, CircleCheck, Landmark, PiggyBank, Scale, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useStore } from '../store'
import { distribucionCuentas, resumenFondos, saldosCuentas } from '../lib/calc'
import { money, pct } from '../lib/format'
import { ICONO_CUENTA, iconoDe } from '../lib/iconos'
import { Barra, Card, Dato, Empty, EstadoPill, IconBadge, KPI, Td, Th, tonoEstado } from '../components/ui'

export function Cuentas({ mes }: { mes: string }) {
  const s = useStore()
  const saldos = useMemo(() => saldosCuentas(s), [s])
  const f = useMemo(() => resumenFondos(s, mes), [s, mes])
  const dist = useMemo(() => distribucionCuentas(s, mes), [s, mes])
  const mon = s.ajustes.moneda
  const total = saldos.reduce((a, c) => a + c.saldoActual, 0)
  const pctOk = Math.abs(f.totalPct - 1) < 0.0001

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Landmark} label="Saldo total en cuentas" value={money(total, mon)} />
        <KPI icon={ArrowDownLeft} label="Ingreso registrado del mes" value={money(f.ingresoMes, mon)} />
        <KPI icon={Scale} label="Saldo neto del mes" value={money(f.saldoNetoMes, mon)} tone={f.saldoNetoMes < 0 ? 'bad' : 'ok'} hint="asignado menos usado" />
        <KPI icon={ShieldCheck} label="Neto acumulado" value={money(f.saldoNetoAcumulado, mon)} hint={`Emergencias ${money(f.emergenciasAcumulado, mon)}`} />
      </div>

      <Card icon={Wallet} title="Cuentas y saldos" subtitle="Saldo inicial, más ingresos y transferencias recibidas, menos gastos y transferencias enviadas">
        {saldos.length === 0 ? (
          <Empty icon={Landmark} title="Sin cuentas">
            Agrega tus cuentas en Ajustes.
          </Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {saldos.map((c) => (
              <div key={c.cuenta.id} className="min-w-0 rounded-2xl border border-line p-4 bg-gradient-to-b from-surface-2/60 to-transparent">
                <div className="flex items-center gap-3">
                  <IconBadge icon={ICONO_CUENTA[c.cuenta.tipo]} />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{c.cuenta.nombre}</p>
                    <p className="text-xs text-muted truncate">
                      {c.cuenta.tipo}
                      {c.fondos.length > 0 && `, guarda ${c.fondos.map((x) => x.nombre).join(' y ')}`}
                    </p>
                  </div>
                </div>
                <p className={`num font-extrabold text-2xl tracking-tight mt-3 ${c.saldoActual < 0 ? 'text-bad' : ''}`}>{money(c.saldoActual, mon)}</p>
                <div className="space-y-1 mt-3 pt-3 border-t border-line">
                  <Dato k="Saldo inicial" v={money(c.saldoInicial, mon)} />
                  <Dato k="Ingresos" v={`+${money(c.ingresos, mon)}`} cls="text-ok" />
                  <Dato k="Gastos" v={`-${money(c.gastos, mon)}`} cls="text-bad" />
                  <Dato k="Transferencias recibidas" v={`+${money(c.transfRecibidas, mon)}`} />
                  <Dato k="Transferencias enviadas" v={`-${money(c.transfEnviadas, mon)}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        icon={PiggyBank}
        title="Reparto del ingreso por fondos"
        subtitle={
          <span className={`inline-flex items-center gap-1.5 ${pctOk ? '' : 'text-warn font-semibold'}`}>
            {pctOk ? <CircleCheck size={13} className="text-ok" /> : <TriangleAlert size={13} />}
            {pctOk ? 'El reparto suma 100%' : `El reparto suma ${pct(f.totalPct, 1)}; ajústalo en Ajustes`}
          </span>
        }
        padding={false}
      >
        {/* Móvil: tarjetas */}
        <ul className="md:hidden divide-y divide-line mt-2">
          {f.filas.map((x) => (
            <li key={x.fondo.id} className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <IconBadge icon={iconoDe(x.fondo)} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {x.fondo.nombre} <span className="text-muted font-medium">{pct(x.fondo.porcentaje)}</span>
                  </p>
                  <p className="text-xs text-muted truncate">{x.cuenta ? `Vive en ${x.cuenta.nombre}` : 'Sin cuenta asignada'}</p>
                </div>
                <EstadoPill estado={x.estado} />
              </div>
              <div className="my-2.5">
                <Barra pct={x.pctUsado} tone={tonoEstado(x.estado)} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Dato k="Asignado" v={money(x.asignado, mon)} />
                <Dato k="Usado" v={money(x.usado, mon)} />
                <Dato k="Saldo del mes" v={money(x.saldoMes, mon)} cls={x.saldoMes < 0 ? 'text-bad' : ''} />
                <Dato k="Acumulado" v={money(x.saldoAcumulado, mon)} cls={x.saldoAcumulado < 0 ? 'text-bad' : ''} />
              </div>
            </li>
          ))}
        </ul>
        {/* Escritorio: tabla */}
        <div className="hidden md:block scroll-x">
          <table className="w-full min-w-[760px] mt-3">
            <thead className="border-b border-line">
              <tr>
                <Th className="pl-5">Fondo</Th>
                <Th right>%</Th>
                <Th right>Asignado</Th>
                <Th right>Usado</Th>
                <Th>Uso</Th>
                <Th right>Saldo del mes</Th>
                <Th>Estado</Th>
                <Th right>Acumulado</Th>
                <Th>Cuenta</Th>
                <Th right className="pr-5">Saldo cuenta</Th>
              </tr>
            </thead>
            <tbody>
              {f.filas.map((x) => (
                <tr key={x.fondo.id} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                  <Td className="pl-5">
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <IconBadge icon={iconoDe(x.fondo)} size="sm" />
                      {x.fondo.nombre}
                    </span>
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
                  <Td right className="pr-5">{money(x.saldoCuenta, mon)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card icon={ArrowRightLeft} title="¿Cuánto debe recibir cada cuenta este mes?" subtitle="Pendiente positivo: falta transferir a esa cuenta. Negativo: tiene de más y debe enviar." padding={false}>
        <ul className="divide-y divide-line mt-2">
          {dist.map((x) => {
            const pend = Math.abs(x.pendiente) > 0.005
            return (
              <li key={x.cuenta.id} className="px-4 md:px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-3 flex-1 min-w-[12rem]">
                  <IconBadge icon={ICONO_CUENTA[x.cuenta.tipo]} size="sm" />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{x.cuenta.nombre}</p>
                    <p className="text-xs text-muted truncate">{x.fondos.map((f) => f.nombre).join(', ') || 'No guarda fondos'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-right w-full sm:w-auto">
                  <Mini k="Debe recibir" v={money(x.debeRecibir, mon)} />
                  <Mini k="Recibió" v={money(x.recibioNeto, mon)} />
                  <Mini k="Pendiente" v={pend ? money(x.pendiente, mon) : 'Al día'} cls={pend ? (x.pendiente > 0 ? 'text-warn' : 'text-primary') : 'text-ok'} />
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

function Mini({ k, v, cls = '' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted">{k}</p>
      <p className={`num text-[13px] sm:text-sm font-bold ${cls}`}>{v}</p>
    </div>
  )
}
