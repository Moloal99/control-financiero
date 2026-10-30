import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownToLine, ArrowUpFromLine, CalendarCheck, CircleCheck, Hourglass, LifeBuoy, Pencil, PiggyBank, Plus, Target, Trash2, TrendingUp, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { gastoPromedioMensual, mesesEntre, mesesParaMeta, metas as calcularMetas, resumenFondos, type EstadoMeta, type ProgresoMeta } from '../lib/calc'
import { confirmar, toast, vibrar } from '../lib/feedback'
import { hoyISO, mesActual, mesDe, money, nombreMes, num, uid } from '../lib/format'
import { ICONOS, iconoDe } from '../lib/iconos'
import { fondoNuevo } from '../lib/seed'
import { useUI } from '../lib/ui'
import type { Fondo, Meta } from '../types'
import { Anillo, BarraHitos, Card, Empty, Field, IconBadge, KPI, Modal, Segmented } from '../components/ui'

const ESTADO: Record<EstadoMeta, { texto: string; color: string; icono: typeof Target }> = {
  cumplida: { texto: 'Cumplida', color: 'var(--ok)', icono: CircleCheck },
  adelantada: { texto: 'Adelantada', color: 'var(--ok)', icono: TrendingUp },
  'en camino': { texto: 'En camino', color: 'var(--primary)', icono: CalendarCheck },
  atrasada: { texto: 'Atrasada', color: 'var(--warn)', icono: TriangleAlert },
  'sin fecha': { texto: 'Sin fecha límite', color: 'var(--c5)', icono: Hourglass },
  'sin aportes': { texto: 'Sin aportes', color: 'var(--muted)', icono: Hourglass },
}

export function Metas() {
  const s = useStore()
  const mon = s.ajustes.moneda
  const lista = useMemo(() => calcularMetas(s), [s])
  const f = useMemo(() => resumenFondos(s, mesActual()), [s])
  const [editar, setEditar] = useState<{ fondo: Fondo | null } | null>(null)
  const sinMeta = s.fondos.filter((x) => x.tipo === 'ahorro' && !x.meta && !x.archivado)
  const aportadoMes = lista.reduce((a, m) => a + m.aportadoEsteMes, 0)
  const faltaMes = lista.reduce((a, m) => a + m.faltaEsteMes, 0)
  const emergencia = lista.find((m) => m.fondo.meta?.tipo === 'emergencia')

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={PiggyBank} label="Ahorrado en total" value={money(f.ahorroTotal, mon)} tone="ok" hint="en tus fondos de ahorro" />
        <KPI icon={ArrowDownToLine} label="Apartado este mes" value={money(aportadoMes, mon)} hint="a tus metas" />
        <KPI icon={Hourglass} label="Falta apartar este mes" value={money(faltaMes, mon)} tone={faltaMes > 0.5 ? 'warn' : 'ok'} hint={faltaMes > 0.5 ? 'para ir al día' : 'vas al día'} />
        <KPI icon={LifeBuoy} label="Emergencias cubren" value={emergencia ? `${(emergencia.actual / Math.max(1, gastoPromedioMensual(s))).toFixed(1)} meses` : '—'} hint={emergencia ? `de ${emergencia.fondo.meta?.meses ?? 3} meses de gasto` : 'crea un fondo de emergencia'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={() => setEditar({ fondo: null })}>
          <Plus size={18} /> Nueva meta
        </button>
        {faltaMes > 0.5 && (
          <button className="btn btn-soft" onClick={() => useUI.getState().abrirPagate()}>
            <PiggyBank size={17} /> Apartar lo de este mes
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <Card>
          <Empty
            icon={Target}
            title="Ponle un objetivo a tu ahorro"
            action={
              <button className="btn btn-primary" onClick={() => setEditar({ fondo: null })}>
                <Plus size={18} /> Crear mi primera meta
              </button>
            }
          >
            Cada meta tiene su propio fondo dentro de una cuenta. La app te dice cuánto apartar al mes y cuándo llegarás.
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence initial={false}>
            {lista.map((m) => (
              <TarjetaMeta key={m.fondo.id} m={m} mon={mon} onEditar={() => setEditar({ fondo: m.fondo })} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {sinMeta.length > 0 && (
        <Card title="Fondos de ahorro sin meta" subtitle="Ponles un objetivo para ver cuánto te falta y cuándo llegarás">
          <ul className="divide-y divide-line -my-1">
            {sinMeta.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2.5">
                <IconBadge icon={iconoDe(x)} size="sm" color="var(--ok)" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{x.nombre}</p>
                  <p className="text-xs text-muted num">{money(f.filas.find((y) => y.fondo.id === x.id)?.saldo ?? 0, mon)}</p>
                </div>
                <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={() => setEditar({ fondo: x })}>
                  <Target size={15} /> Ponerle meta
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <EditorMeta abierto={editar} onClose={() => setEditar(null)} />
    </div>
  )
}

function TarjetaMeta({ m, mon, onEditar }: { m: ProgresoMeta; mon: string; onEditar: () => void }) {
  const est = ESTADO[m.estado]
  const IconoEstado = est.icono
  const cumplida = m.estado === 'cumplida'
  const cuenta = useStore((s) => s.cuentas.find((c) => c.id === m.fondo.cuentaId)?.nombre)
  const abrir = useUI((u) => u.abrirRegistro)
  // Dónde deberías ir hoy si la meta tiene fecha: proporción lineal desde que se creó.
  const marca = (() => {
    const meta = m.fondo.meta
    if (!meta?.fecha || cumplida) return null
    const total = Math.max(1, mesesEntre(mesDe(meta.creada), mesDe(meta.fecha)))
    const pasados = Math.max(0, mesesEntre(mesDe(meta.creada), mesActual()))
    return Math.min(1, pasados / total)
  })()

  return (
    <motion.section layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className={`card p-4 md:p-5 min-w-0 ${cumplida ? 'border-ok/40' : ''}`}>
      <div className="flex items-start gap-4">
        <Anillo pct={m.pct} color={est.color} size={76} grosor={8}>
          {cumplida ? (
            <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.4 }}>
              <CircleCheck size={28} style={{ color: est.color }} />
            </motion.span>
          ) : (
            <span className="num font-extrabold text-[17px] leading-none">{Math.round(m.pct * 100)}%</span>
          )}
        </Anillo>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-extrabold text-lg leading-tight tracking-tight truncate">{m.fondo.nombre}</p>
              <p className="text-xs text-muted truncate">
                {m.fondo.meta?.tipo === 'emergencia' ? `${m.fondo.meta.meses} meses de gasto` : m.fondo.meta?.fecha ? `Para ${nombreMes(mesDe(m.fondo.meta.fecha)).toLowerCase()}` : 'Sin fecha límite'}
                {cuenta ? `, en ${cuenta}` : ''}
              </p>
            </div>
            <button className="btn btn-icon text-muted -mt-1 -mr-1" onClick={onEditar} aria-label={`Editar ${m.fondo.nombre}`}>
              <Pencil size={16} />
            </button>
          </div>
          <p className="num mt-2">
            <span className="text-xl font-extrabold">{money(m.actual, mon)}</span>
            <span className="text-sm text-muted"> de {money(m.objetivo, mon)}</span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <BarraHitos pct={m.pct} color={est.color} marca={marca} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="pill" style={{ background: `color-mix(in srgb, ${est.color} 14%, transparent)`, color: est.color }}>
          <IconoEstado size={12} strokeWidth={2.5} /> {est.texto}
        </span>
        {!cumplida && m.falta > 0 && <span className="text-xs text-muted">Faltan {money(m.falta, mon)}</span>}
      </div>

      {!cumplida && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-4 text-sm">
          <Dato k={m.cuotaNecesaria !== null ? 'Necesitas por mes' : 'Plan por mes'} v={money(m.cuotaNecesaria ?? m.plan, mon)} />
          <Dato k="Vas ahorrando por mes" v={m.ritmo > 0 ? money(m.ritmo, mon) : 'Aún sin historia'} />
          <Dato k="Llegas en" v={m.fechaEstimada ? nombreMes(m.fechaEstimada) : 'Sin aportes'} />
          <Dato k="Este mes" v={`${money(m.aportadoEsteMes, mon)}${m.faltaEsteMes > 0.5 ? `, faltan ${money(m.faltaEsteMes, mon)}` : ''}`} />
        </dl>
      )}

      <div className="flex gap-2 mt-4">
        <button className="btn btn-soft flex-1 !min-h-10" onClick={() => abrir({ pestana: 'mover', preset: { fondoDestinoId: m.fondo.id, cuentaDestinoId: m.fondo.cuentaId, monto: m.faltaEsteMes > 0.5 ? Math.ceil(m.faltaEsteMes) : undefined, descripcion: `Aporte a ${m.fondo.nombre}` } })}>
          <ArrowDownToLine size={16} /> Aportar
        </button>
        <button className="btn btn-ghost flex-1 !min-h-10" onClick={() => abrir({ pestana: 'mover', preset: { fondoOrigenId: m.fondo.id, cuentaOrigenId: m.fondo.cuentaId, descripcion: `Retiro de ${m.fondo.nombre}` } })}>
          <ArrowUpFromLine size={16} /> Retirar
        </button>
      </div>
    </motion.section>
  )
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="num font-bold truncate">{v}</dd>
    </div>
  )
}

/* ───────────────────────── Crear / editar meta ───────────────────────── */

function EditorMeta({ abierto, onClose }: { abierto: { fondo: Fondo | null } | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(abierto)} onClose={onClose} title={abierto?.fondo?.meta ? `Editar ${abierto.fondo.nombre}` : abierto?.fondo ? `Meta para ${abierto.fondo.nombre}` : 'Nueva meta'}>
      {abierto && <FormMeta key={abierto.fondo?.id ?? 'nueva'} fondo={abierto.fondo} onClose={onClose} />}
    </Modal>
  )
}

const ICONOS_META = ['metas', 'viajes', 'auto', 'casa', 'educacion', 'emergencias', 'regalos', 'celular', 'salud', 'inversion', 'ahorro', 'mascotas', 'hijos', 'negocio']

function FormMeta({ fondo, onClose }: { fondo: Fondo | null; onClose: () => void }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const resumen = useMemo(() => resumenFondos(s, mesActual()), [s])
  const meta = fondo?.meta
  const [nombre, setNombre] = useState(fondo?.nombre ?? '')
  const [icono, setIcono] = useState(fondo?.icono ?? 'metas')
  const [tipo, setTipo] = useState<Meta['tipo']>(meta?.tipo ?? 'monto')
  const [objetivo, setObjetivo] = useState(meta?.objetivo ? String(meta.objetivo) : '')
  const [meses, setMeses] = useState(String(meta?.meses ?? 3))
  const [conFecha, setConFecha] = useState(meta ? Boolean(meta.fecha) : true)
  const [fecha, setFecha] = useState(() => meta?.fecha ?? `${Number(hoyISO().slice(0, 4)) + 1}-${hoyISO().slice(5, 7)}-28`)
  const [cuentaId, setCuentaId] = useState(fondo?.cuentaId ?? s.fondos.find((f) => f.tipo === 'ahorro')?.cuentaId ?? s.cuentas[0]?.id ?? '')
  const [porcentaje, setPorcentaje] = useState(String(Math.round((fondo?.porcentaje ?? 0) * 1000) / 10))
  const [aporte, setAporte] = useState(String(fondo?.aporteMensual ?? 0))
  const [inicial, setInicial] = useState('')
  const [fuente, setFuente] = useState(resumen.sinAsignar > 0 ? '' : (s.fondos.find((f) => f.tipo === 'ahorro' && f.id !== fondo?.id)?.id ?? ''))

  const objetivoN = tipo === 'emergencia' ? Math.round(num(meses) * gastoPromedioMensual(s) * 100) / 100 : num(objetivo)
  const actual = fondo ? (resumen.filas.find((f) => f.fondo.id === fondo.id)?.saldo ?? 0) : 0
  const inicialN = num(inicial)
  const falta = Math.max(0, objetivoN - actual - inicialN)
  const mesesRest = conFecha && fecha ? mesesParaMeta(mesActual(), fecha) : null
  const cuota = mesesRest ? falta / mesesRest : null
  const otrosPct = s.fondos.filter((f) => f.id !== fondo?.id && !f.archivado).reduce((a, f) => a + f.porcentaje, 0)
  const pctN = num(porcentaje) / 100
  const fuentes = [{ id: '', nombre: 'Sin asignar', saldo: resumen.sinAsignar }, ...resumen.filas.filter((f) => f.fondo.id !== fondo?.id).map((f) => ({ id: f.fondo.id, nombre: f.fondo.nombre, saldo: f.saldo }))]

  const validacion = !nombre.trim() ? 'Ponle un nombre' : !(objetivoN > 0) ? (tipo === 'emergencia' ? 'Aún no hay gasto promedio; registra gastos o usa un monto' : 'Ingresa el monto objetivo') : !cuentaId ? 'Elige la cuenta donde vive' : null

  const guardar = () => {
    if (validacion) return
    const nuevaMeta: Meta = {
      tipo,
      objetivo: tipo === 'emergencia' ? 0 : objetivoN,
      meses: tipo === 'emergencia' ? Math.max(1, num(meses)) : undefined,
      fecha: tipo === 'emergencia' || !conFecha ? null : fecha,
      creada: meta?.creada ?? hoyISO(),
    }
    const f: Fondo = fondo
      ? { ...fondo, nombre: nombre.trim(), icono, cuentaId, porcentaje: pctN, aporteMensual: num(aporte), tipo: 'ahorro', meta: nuevaMeta }
      : fondoNuevo({ id: uid(), nombre: nombre.trim(), icono, cuentaId, porcentaje: pctN, aporteMensual: num(aporte), tipo: 'ahorro', meta: nuevaMeta, fechaSaldo: hoyISO() })
    s.guardarFondo(f)
    if (inicialN > 0) {
      const origen = s.fondos.find((x) => x.id === fuente)
      s.agregarMovimiento({
        fecha: hoyISO(),
        tipo: 'transferencia',
        descripcion: `Aporte inicial a ${f.nombre}`,
        cuentaOrigenId: origen?.cuentaId ?? cuentaId,
        cuentaDestinoId: cuentaId,
        monto: inicialN,
        fondoOrigenId: fuente || null,
        fondoDestinoId: f.id,
        recurrenteId: null,
      })
    }
    vibrar(20)
    toast(fondo?.meta ? 'Meta actualizada' : 'Meta creada', { detalle: cuota ? `Aparta ${money(cuota, mon)} al mes para llegar a tiempo` : undefined })
    onClose()
  }

  const quitar = async () => {
    if (!fondo) return
    const saldo = actual
    const opcion = await confirmar(`¿Quitar la meta ${fondo.nombre}?`, {
      texto: saldo > 0 ? `El fondo conserva sus ${money(saldo, mon)}. Solo se quita el objetivo.` : 'El fondo se elimina porque no tiene saldo.',
      aceptar: 'Quitar meta',
      peligro: true,
    })
    if (!opcion) return
    if (saldo > 0.005 || s.gastos.some((g) => g.fondoId === fondo.id) || s.movimientos.some((m) => m.fondoOrigenId === fondo.id || m.fondoDestinoId === fondo.id)) s.guardarFondo({ ...fondo, meta: null })
    else s.eliminarFondo(fondo.id)
    toast('Meta quitada', { tono: 'info' })
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
      <Field label="Nombre">
        <input className="input" placeholder="Viaje a Cusco, auto, fondo de emergencia…" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!fondo} />
      </Field>
      <Field label="Icono" grupo>
        <div className="flex flex-wrap gap-2">
          {ICONOS_META.map((k) => {
            const I = ICONOS[k].icono
            return (
              <button key={k} type="button" onClick={() => setIcono(k)} title={ICONOS[k].nombre} aria-label={ICONOS[k].nombre} aria-pressed={icono === k} className={`h-10 w-10 rounded-xl grid place-items-center transition-colors ${icono === k ? 'bg-ok text-white' : 'bg-surface-2 hover:bg-surface-3'}`}>
                <I size={19} />
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Tipo de meta" grupo>
        <Segmented
          full
          value={tipo}
          onChange={setTipo}
          options={[
            { id: 'monto', label: 'Monto', icon: Target },
            { id: 'emergencia', label: 'Emergencia', icon: LifeBuoy },
          ]}
        />
      </Field>
      {tipo === 'monto' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={`Monto objetivo (${mon})`}>
            <input className="input num text-lg font-bold" inputMode="decimal" placeholder="10.000" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          </Field>
          <Field label="Fecha objetivo" grupo>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={conFecha} onChange={(e) => setConFecha(e.target.checked)} aria-label="Con fecha límite" />
              <input className="input flex-1 min-w-0" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={!conFecha} aria-label="Fecha objetivo" />
            </div>
          </Field>
        </div>
      ) : (
        <Field label="Meses de gasto que quieres cubrir" hint={`Tu gasto promedio es ${money(gastoPromedioMensual(s), mon)} al mes; el objetivo se actualiza solo.`}>
          <Segmented full value={meses} onChange={setMeses} options={['3', '6', '9', '12'].map((x) => ({ id: x, label: `${x} meses` }))} />
        </Field>
      )}

      <div className="rounded-2xl bg-surface-2 p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted">Objetivo</p>
          <p className="num font-extrabold text-lg">{money(objetivoN, mon)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">{cuota !== null ? `Aparta por mes (${mesesRest} meses)` : 'Te falta'}</p>
          <p className="num font-extrabold text-lg text-ok">{money(cuota ?? falta, mon)}</p>
        </div>
      </div>

      <Field label="Cuenta donde vive el dinero">
        <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
          <option value="">Elegir cuenta</option>
          {s.cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="% de cada ingreso" hint={`Tus otros fondos suman ${Math.round(otrosPct * 1000) / 10}%`}>
          <div className="relative">
            <input className="input num text-right !pr-8" inputMode="decimal" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">%</span>
          </div>
        </Field>
        <Field label="Aporte fijo al mes" hint="Además del %, para la proyección">
          <input className="input num text-right" inputMode="decimal" value={aporte} onChange={(e) => setAporte(e.target.value)} />
        </Field>
      </div>
      {otrosPct + pctN > 1.0001 && <p className="text-xs text-warn font-semibold -mt-3">Con este % tus fondos suman {Math.round((otrosPct + pctN) * 1000) / 10}%. Baja el de otro fondo en Ajustes.</p>}

      <div className="rounded-2xl border border-line p-4 space-y-3">
        <p className="text-sm font-bold">¿Ya tienes algo ahorrado para esto?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Monto">
            <input className="input num" inputMode="decimal" placeholder="0" value={inicial} onChange={(e) => setInicial(e.target.value)} />
          </Field>
          <Field label="Lo tomas de">
            <select className="input" value={fuente} onChange={(e) => setFuente(e.target.value)}>
              {fuentes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} ({money(x.saldo, mon)})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {fondo?.meta && (
        <button type="button" className="btn btn-danger w-full" onClick={quitar}>
          <Trash2 size={16} /> Quitar meta
        </button>
      )}

      <div className="sticky -bottom-4 md:-bottom-5 -mx-4 md:-mx-5 -mb-4 md:-mb-5 px-4 md:px-5 pt-3 pb-4 md:pb-5 bg-surface border-t border-line flex items-center justify-between gap-3 z-10">
        <p className={`text-[13px] font-semibold ${validacion ? 'text-muted' : 'text-ok'}`}>{validacion ?? (cuota ? `${money(cuota, mon)} al mes` : 'Listo')}</p>
        <button type="submit" className="btn btn-primary" disabled={Boolean(validacion)}>
          {fondo?.meta ? 'Guardar cambios' : 'Crear meta'}
        </button>
      </div>
    </form>
  )
}
