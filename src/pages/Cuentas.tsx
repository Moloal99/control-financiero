import { motion } from 'motion/react'
import { ArrowLeftRight, ArrowRight, Info, Landmark, PiggyBank, Plus, Scale, Wallet, Inbox, Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { cuadreCuentas, resumenFondos, saldoCuentaEn, saldosCuentas, type SaldoCuenta } from '../lib/calc'
import { toast, vibrar } from '../lib/feedback'
import { fechaCorta, hoyISO, money, nombreMes, num } from '../lib/format'
import { ICONO_CUENTA, iconoDe } from '../lib/iconos'
import { useUI } from '../lib/ui'
import { Card, Dato, Empty, EstadoPill, Field, IconBadge, KPI, Modal, Td, Th } from '../components/ui'

const COLORES_FONDO = ['var(--c2)', 'var(--c4)', 'var(--c3)', 'var(--c5)', 'var(--c1)', 'var(--c6)', 'var(--c7)', 'var(--c10)', 'var(--c9)', 'var(--c8)']

export function Cuentas({ mes }: { mes: string }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const saldos = useMemo(() => saldosCuentas(s), [s])
  const f = useMemo(() => resumenFondos(s, mes), [s, mes])
  const cuadre = useMemo(() => cuadreCuentas(saldos), [saldos])
  const abrir = useUI((u) => u.abrirRegistro)
  const [ajustar, setAjustar] = useState<SaldoCuenta | null>(null)
  const colorFondo = (id: string) => COLORES_FONDO[Math.max(0, s.fondos.findIndex((x) => x.id === id)) % COLORES_FONDO.length]

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Landmark} label="En tus cuentas" value={money(f.saldoTotalCuentas, mon)} />
        <KPI icon={Wallet} label="Repartido en fondos" value={money(f.saldoTotalFondos, mon)} />
        <KPI icon={PiggyBank} label="En fondos de ahorro" value={money(f.ahorroTotal, mon)} tone="ok" />
        <div className="card p-3.5 md:p-4 min-w-0 flex flex-col">
          <div className="flex flex-col items-start sm:flex-row sm:items-center gap-2">
            <IconBadge icon={Inbox} size="sm" color={f.sinAsignar < -1 ? 'var(--bad)' : f.sinAsignar > 1 ? 'var(--warn)' : 'var(--ok)'} />
            <p className="text-[13px] text-muted leading-tight">Sin asignar</p>
          </div>
          <p className={`num font-extrabold text-lg md:text-[22px] mt-2 leading-tight tracking-tight ${f.sinAsignar < -1 ? 'text-bad' : ''}`}>{money(f.sinAsignar, mon)}</p>
          {f.sinAsignar > 1 ? (
            <button className="text-xs font-bold text-primary mt-1 text-left inline-flex items-center gap-1" onClick={() => abrir({ pestana: 'mover', preset: { fondoOrigenId: null } })}>
              Repartir en fondos <ArrowRight size={12} />
            </button>
          ) : (
            <p className="text-xs text-muted mt-1">{f.sinAsignar < -1 ? 'tus fondos suman más que tus cuentas' : 'todo tiene un propósito'}</p>
          )}
        </div>
      </div>

      {cuadre.length > 0 && (
        <Card icon={ArrowLeftRight} title="Transferencias pendientes" subtitle="Para que cada cuenta tenga el dinero de los fondos que guarda">
          <ul className="space-y-2">
            {cuadre.map((t) => (
              <li key={t.origen.id + t.destino.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5">
                <p className="text-sm flex-1 min-w-[12rem]">
                  Mueve <b className="num">{money(t.monto, mon)}</b> de <b>{t.origen.nombre}</b> a <b>{t.destino.nombre}</b>
                </p>
                <button
                  className="btn btn-soft !min-h-9 !px-3 text-sm"
                  onClick={() => {
                    const id = s.agregarMovimiento({ fecha: hoyISO(), tipo: 'transferencia', descripcion: `De ${t.origen.nombre} a ${t.destino.nombre}`, cuentaOrigenId: t.origen.id, cuentaDestinoId: t.destino.id, monto: t.monto, fondoOrigenId: null, fondoDestinoId: null, recurrenteId: null })
                    vibrar(15)
                    toast('Transferencia registrada', { detalle: 'Hazla también en tu banco.', accion: { texto: 'Deshacer', onClick: () => useStore.getState().eliminarMovimiento(id) } })
                  }}
                >
                  <Check size={15} /> Ya la hice
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card icon={Landmark} title="Cuentas" subtitle="Cuánto hay en cada una y para qué es ese dinero">
        {saldos.length === 0 ? (
          <Empty icon={Landmark} title="Sin cuentas">
            Agrega tus cuentas en Ajustes.
          </Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {saldos.map((c) => (
              <TarjetaCuenta key={c.cuenta.id} c={c} mon={mon} colorFondo={colorFondo} saldoFondo={(id) => f.filas.find((x) => x.fondo.id === id)?.saldo ?? 0} onAjustar={() => setAjustar(c)} />
            ))}
          </div>
        )}
      </Card>

      <Card
        icon={Wallet}
        title={`Fondos en ${nombreMes(mes).toLowerCase()}`}
        subtitle="El saldo de cada fondo pasa de un mes al siguiente"
        padding={false}
        action={
          <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => abrir({ pestana: 'mover' })}>
            <ArrowLeftRight size={15} /> Mover
          </button>
        }
      >
        {f.filas.length === 0 ? (
          <Empty icon={Wallet} title="Sin fondos">
            Crea fondos en Ajustes.
          </Empty>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-line mt-2">
              {f.filas.map((x) => (
                <li key={x.fondo.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <IconBadge icon={iconoDe(x.fondo)} size="sm" color={colorFondo(x.fondo.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{x.fondo.nombre}</p>
                      <p className="text-xs text-muted truncate">
                        {x.fondo.tipo === 'ahorro' ? 'Ahorro' : 'Para gastar'}, {x.cuenta ? x.cuenta.nombre : 'sin cuenta'}
                      </p>
                    </div>
                    <p className={`num font-extrabold ${x.saldo < 0 ? 'text-bad' : ''}`}>{money(x.saldo, mon)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
                    <Dato k="Venía con" v={money(x.saldoAnterior, mon)} />
                    <Dato k="Entró" v={x.entradas ? `+${money(x.entradas, mon)}` : '—'} cls="text-ok" />
                    <Dato k="Gastado" v={x.gastado ? `-${money(x.gastado, mon)}` : '—'} cls="text-bad" />
                    <Dato k="Movido a otros" v={x.salidas ? `-${money(x.salidas, mon)}` : '—'} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block scroll-x">
              <table className="w-full min-w-[760px] mt-3">
                <thead className="border-b border-line">
                  <tr>
                    <Th className="pl-5">Fondo</Th>
                    <Th>Cuenta</Th>
                    <Th right>Venía con</Th>
                    <Th right>Entró</Th>
                    <Th right>Gastado</Th>
                    <Th right>Movido</Th>
                    <Th right>Cierre del mes</Th>
                    <Th>Estado</Th>
                    <Th right className="pr-5">Hoy</Th>
                  </tr>
                </thead>
                <tbody>
                  {f.filas.map((x) => (
                    <tr key={x.fondo.id} className="border-b border-line last:border-0 hover:bg-surface-2/50">
                      <Td className="pl-5">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <IconBadge icon={iconoDe(x.fondo)} size="sm" color={colorFondo(x.fondo.id)} />
                          {x.fondo.nombre}
                        </span>
                      </Td>
                      <Td className="text-muted">{x.cuenta?.nombre ?? '—'}</Td>
                      <Td right>{money(x.saldoAnterior, mon)}</Td>
                      <Td right className="text-ok">{x.entradas ? `+${money(x.entradas, mon)}` : '—'}</Td>
                      <Td right className="text-bad">{x.gastado ? `-${money(x.gastado, mon)}` : '—'}</Td>
                      <Td right>{x.salidas ? `-${money(x.salidas, mon)}` : '—'}</Td>
                      <Td right className={`font-semibold ${x.saldoMes < 0 ? 'text-bad' : ''}`}>{money(x.saldoMes, mon)}</Td>
                      <Td>
                        <EstadoPill estado={x.estado} />
                      </Td>
                      <Td right className={`pr-5 font-bold ${x.saldo < 0 ? 'text-bad' : ''}`}>{money(x.saldo, mon)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <AjustarSaldo c={ajustar} onClose={() => setAjustar(null)} />
    </div>
  )
}

function TarjetaCuenta({ c, mon, colorFondo, saldoFondo, onAjustar }: { c: SaldoCuenta; mon: string; colorFondo: (id: string) => string; saldoFondo: (id: string) => number; onAjustar: () => void }) {
  const [detalle, setDetalle] = useState(false)
  const abrir = useUI((u) => u.abrirRegistro)
  const partes = [
    ...c.fondos.map((f) => ({ id: f.id, nombre: f.nombre, v: Math.max(0, saldoFondo(f.id)), color: colorFondo(f.id) })),
    ...(c.libre > 0.005 ? [{ id: 'libre', nombre: 'Sin asignar', v: c.libre, color: 'var(--surface-3)' }] : []),
  ]
  const totalBarra = partes.reduce((a, p) => a + p.v, 0)
  return (
    <div className="min-w-0 rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <IconBadge icon={ICONO_CUENTA[c.cuenta.tipo]} />
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{c.cuenta.nombre}</p>
          <p className="text-xs text-muted truncate">{c.cuenta.tipo}</p>
        </div>
        <p className={`num font-extrabold text-xl tracking-tight ${c.saldoActual < 0 ? 'text-bad' : ''}`}>{money(c.saldoActual, mon)}</p>
      </div>

      {totalBarra > 0 && (
        <>
          <div className="flex h-3 rounded-full overflow-hidden bg-surface-3/60 mt-4 gap-0.5">
            {partes.map((p) => (
              <motion.div key={p.id} title={`${p.nombre}: ${money(p.v, mon)}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ background: p.color }} initial={{ width: 0 }} animate={{ width: `${(p.v / totalBarra) * 100}%` }} transition={{ duration: 0.7 }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
            {partes.map((p) => (
              <li key={p.id} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: p.id === 'libre' ? 'var(--muted)' : p.color }} />
                <span className="text-muted">{p.nombre}</span>
                <span className="num font-semibold">{money(p.v, mon)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {c.libre < -0.005 && (
        <p className="text-xs text-warn font-semibold mt-2">Sus fondos suman {money(c.enFondos, mon)}: faltan {money(-c.libre, mon)} en esta cuenta.</p>
      )}

      {c.anterioresAlSaldo > 0 && (
        <p className="text-xs text-muted mt-3 flex gap-1.5 leading-snug">
          <Info size={14} className="shrink-0 mt-px" />
          <span>
            Hay {c.anterioresAlSaldo} registro{c.anterioresAlSaldo === 1 ? '' : 's'} antes del {fechaCorta(c.cuenta.fechaSaldo)}. No cambian el saldo, porque el saldo inicial de ese día ya los incluye. Si no coincide con tu banco, usa Ajustar al banco.
          </span>
        </p>
      )}

      {detalle && (
        <div className="space-y-1 mt-3 pt-3 border-t border-line">
          <Dato k={`Saldo al ${fechaCorta(c.cuenta.fechaSaldo)}`} v={money(c.saldoInicial, mon)} />
          <Dato k="Ingresos" v={`+${money(c.ingresos, mon)}`} cls="text-ok" />
          <Dato k="Gastos" v={`-${money(c.gastos, mon)}`} cls="text-bad" />
          <Dato k="Transferencias recibidas" v={`+${money(c.transfRecibidas, mon)}`} />
          <Dato k="Transferencias enviadas" v={`-${money(c.transfEnviadas, mon)}`} />
          {Math.abs(c.ajustes) > 0.005 && <Dato k="Ajustes al banco" v={money(c.ajustes, mon)} />}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={onAjustar}>
          <Scale size={15} /> Ajustar al banco
        </button>
        <button className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={() => abrir({ pestana: 'mover', preset: { cuentaOrigenId: c.cuenta.id } })}>
          <ArrowLeftRight size={15} /> Mover
        </button>
        <button className="btn !min-h-9 !px-3 text-sm text-muted hover:bg-surface-2" onClick={() => setDetalle((d) => !d)} aria-expanded={detalle}>
          {detalle ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
      </div>
    </div>
  )
}

function AjustarSaldo({ c, onClose }: { c: SaldoCuenta | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(c)} onClose={onClose} title={c ? `Ajustar ${c.cuenta.nombre}` : 'Ajustar'}>
      {c && <FormAjustar key={c.cuenta.id} c={c} onClose={onClose} />}
    </Modal>
  )
}

function FormAjustar({ c, onClose }: { c: SaldoCuenta; onClose: () => void }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const [banco, setBanco] = useState('')
  const [fondo, setFondo] = useState('')
  const bancoN = num(banco)
  // Saldo a hoy (sin registros con fecha futura), que es lo que muestra el banco.
  const saldoHoy = saldoCuentaEn(s, c.cuenta, hoyISO())
  const diferencia = Math.round((bancoN - saldoHoy) * 100) / 100
  const valido = banco.trim() !== '' && Math.abs(diferencia) >= 0.01

  const guardar = () => {
    if (!valido) return
    const id = s.agregarMovimiento({
      fecha: hoyISO(),
      tipo: 'ajuste',
      descripcion: `Ajuste al saldo del banco (${c.cuenta.nombre})`,
      cuentaOrigenId: null,
      cuentaDestinoId: c.cuenta.id,
      monto: diferencia,
      fondoOrigenId: null,
      fondoDestinoId: fondo || null,
      recurrenteId: null,
    })
    vibrar(18)
    toast(`${c.cuenta.nombre} ahora coincide con tu banco`, { detalle: `Ajuste de ${diferencia > 0 ? '+' : ''}${money(diferencia, mon)}`, accion: { texto: 'Deshacer', onClick: () => useStore.getState().eliminarMovimiento(id) } })
    onClose()
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <div className="rounded-2xl bg-surface-2 p-4">
        <p className="text-xs text-muted">Según la app, hoy</p>
        <p className="num font-extrabold text-2xl">{money(saldoHoy, mon)}</p>
      </div>
      <Field label="¿Cuánto dice tu banco hoy?">
        <input className="input num text-lg font-bold" inputMode="decimal" placeholder="0,00" value={banco} onChange={(e) => setBanco(e.target.value)} autoFocus />
      </Field>
      {banco.trim() !== '' && (
        <p className={`text-sm font-semibold ${Math.abs(diferencia) < 0.01 ? 'text-ok' : diferencia > 0 ? 'text-ok' : 'text-bad'}`}>
          {Math.abs(diferencia) < 0.01 ? 'Ya coincide, no hace falta ajustar.' : `Se registra un ajuste de ${diferencia > 0 ? '+' : ''}${money(diferencia, mon)} con fecha de hoy.`}
        </p>
      )}
      <Field label="¿A qué fondo afecta la diferencia?" hint="Si no sabes, déjala sin asignar y luego repártela.">
        <select className="input" value={fondo} onChange={(e) => setFondo(e.target.value)}>
          <option value="">Sin asignar</option>
          {s.fondos
            .filter((f) => !f.archivado)
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
        </select>
      </Field>
      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <button type="button" className="btn btn-ghost sm:flex-1" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary sm:flex-[2]" disabled={!valido}>
          <Plus size={17} /> Registrar ajuste
        </button>
      </div>
    </form>
  )
}
