import { motion } from 'motion/react'
import { Check, PartyPopper } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { metas as calcularMetas, resumenFondos, type ProgresoMeta } from '../lib/calc'
import { toast, vibrar } from '../lib/feedback'
import { hoyISO, mesActual, money, num } from '../lib/format'
import { iconoDe } from '../lib/iconos'
import { useUI } from '../lib/ui'
import type { Movimiento } from '../types'
import { Empty, Field, IconBadge, Modal } from './ui'

/** "Págate primero": propone apartar lo que cada meta necesita este mes, antes de gastar. */
export function Pagate() {
  const pagate = useUI((u) => u.pagate)
  const cerrar = useUI((u) => u.cerrarPagate)
  return (
    <Modal open={Boolean(pagate)} onClose={cerrar} title="Págate primero">
      {pagate && <Contenido cuentaIngreso={pagate.cuentaId ?? null} onClose={cerrar} />}
    </Modal>
  )
}

function Contenido({ cuentaIngreso, onClose }: { cuentaIngreso: string | null; onClose: () => void }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const pendientes = useMemo(() => calcularMetas(s).filter((m) => m.faltaEsteMes > 0.5), [s])
  const fondosR = useMemo(() => resumenFondos(s, mesActual()), [s])
  const saldo = (id: string) => (id ? (fondosR.filas.find((f) => f.fondo.id === id)?.saldo ?? 0) : fondosR.sinAsignar)
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(pendientes.map((m) => [m.fondo.id, true])))
  const [montos, setMontos] = useState<Record<string, string>>(() => Object.fromEntries(pendientes.map((m) => [m.fondo.id, String(Math.ceil(m.faltaEsteMes))])))
  const total = pendientes.filter((m) => sel[m.fondo.id]).reduce((a, m) => a + num(montos[m.fondo.id] ?? '0'), 0)
  const fuentes = [{ id: '', nombre: 'Sin asignar' }, ...s.fondos.filter((f) => f.tipo === 'gasto' && !f.archivado)]
  const [fuente, setFuente] = useState(() => {
    if (fondosR.sinAsignar >= total - 0.5) return ''
    return [...fuentes.slice(1)].sort((a, b) => saldo(b.id) - saldo(a.id))[0]?.id ?? ''
  })

  if (pendientes.length === 0) {
    return (
      <Empty icon={PartyPopper} title="Tus metas están al día" action={<button className="btn btn-primary" onClick={onClose}>Listo</button>}>
        Ya apartaste lo que tus metas necesitan este mes.
      </Empty>
    )
  }

  const apartar = () => {
    const fondoFuente = s.fondos.find((f) => f.id === fuente)
    const movs: Omit<Movimiento, 'id'>[] = pendientes
      .filter((m) => sel[m.fondo.id] && num(montos[m.fondo.id] ?? '0') > 0)
      .map((m) => {
        const cuentaO = fondoFuente?.cuentaId ?? cuentaIngreso ?? m.fondo.cuentaId ?? s.cuentas[0]?.id ?? null
        return {
          fecha: hoyISO(),
          tipo: 'transferencia',
          descripcion: `Aporte a ${m.fondo.nombre}`,
          cuentaOrigenId: cuentaO,
          cuentaDestinoId: m.fondo.cuentaId ?? cuentaO,
          monto: num(montos[m.fondo.id]),
          fondoOrigenId: fuente || null,
          fondoDestinoId: m.fondo.id,
          recurrenteId: null,
        }
      })
    if (movs.length === 0) return
    const ids = s.agregarMovimientos(movs)
    vibrar(25)
    toast(`Apartaste ${money(total, mon)} para tus metas`, {
      detalle: movs.map((m) => s.fondos.find((f) => f.id === m.fondoDestinoId)?.nombre).join(', '),
      accion: {
        texto: 'Deshacer',
        onClick: () => {
          const st = useStore.getState()
          for (const id of ids) st.eliminarMovimiento(id)
        },
      },
      duracion: 6000,
    })
    onClose()
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted leading-relaxed">Aparta para tus metas antes de empezar a gastar. Estos son los aportes que te faltan este mes para ir al día.</p>
      <ul className="space-y-2.5">
        {pendientes.map((m) => (
          <FilaMeta
            key={m.fondo.id}
            m={m}
            mon={mon}
            activo={Boolean(sel[m.fondo.id])}
            onActivo={(v) => setSel((x) => ({ ...x, [m.fondo.id]: v }))}
            valor={montos[m.fondo.id] ?? ''}
            onValor={(v) => setMontos((x) => ({ ...x, [m.fondo.id]: v }))}
          />
        ))}
      </ul>
      <Field label="Sale de">
        <select className="input" value={fuente} onChange={(e) => setFuente(e.target.value)}>
          {fuentes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre} ({money(saldo(f.id), mon)})
            </option>
          ))}
        </select>
      </Field>
      {saldo(fuente) < total - 0.5 && <p className="text-xs text-warn font-semibold -mt-3">{fuentes.find((f) => f.id === fuente)?.nombre} tiene {money(saldo(fuente), mon)}; quedará en negativo.</p>}
      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <button className="btn btn-ghost sm:flex-1" onClick={onClose}>
          Ahora no
        </button>
        <motion.button whileTap={{ scale: 0.97 }} className="btn btn-primary sm:flex-[2]" onClick={apartar} disabled={total <= 0}>
          <Check size={18} /> Apartar {money(total, mon)}
        </motion.button>
      </div>
    </div>
  )
}

function FilaMeta({ m, mon, activo, onActivo, valor, onValor }: { m: ProgresoMeta; mon: string; activo: boolean; onActivo: (v: boolean) => void; valor: string; onValor: (v: string) => void }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${activo ? 'border-primary/50 bg-primary-soft/40' : 'border-line'}`}>
      <input type="checkbox" checked={activo} onChange={(e) => onActivo(e.target.checked)} aria-label={`Aportar a ${m.fondo.nombre}`} />
      <IconBadge icon={iconoDe(m.fondo)} size="sm" color="var(--ok)" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{m.fondo.nombre}</p>
        <p className="text-xs text-muted truncate">
          {Math.round(m.pct * 100)}% de {money(m.objetivo, mon)}
          {m.cuotaNecesaria !== null ? `, ${money(m.cuotaNecesaria, mon)}/mes` : ''}
        </p>
      </div>
      <div className="relative w-28 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">{mon}</span>
        <input className="input !min-h-10 !pl-8 text-right num font-bold" inputMode="decimal" value={valor} onChange={(e) => onValor(e.target.value)} disabled={!activo} aria-label={`Monto para ${m.fondo.nombre}`} />
      </div>
    </li>
  )
}
