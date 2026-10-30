import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownLeft, ArrowDown, Check, ChevronDown, CircleAlert, Inbox, PiggyBank, RotateCcw, ShoppingBag, TriangleAlert } from 'lucide-react'
import { createElement, useMemo, useState, type ReactNode } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { useStore } from '../store'
import { impactoGasto, metas, repartoIngreso, resumenFondos, resumenMes } from '../lib/calc'
import { confirmar, toast, vibrar } from '../lib/feedback'
import { hoyISO, mesActual, mesDe, money, num } from '../lib/format'
import { ICONO_CUENTA, iconoDe, iconoMetodo } from '../lib/iconos'
import { useUI, type PestanaRegistro } from '../lib/ui'
import type { Cuenta, Datos, Fondo, Gasto, Movimiento } from '../types'
import { Field, IconBadge, Modal, Segmented, Switch } from './ui'

/* ───────────────────────── Hoja de registro (global) ───────────────────────── */

export function Registrar() {
  const apertura = useUI((s) => s.registro)
  const cerrar = useUI((s) => s.cerrarRegistro)
  // Conserva el contenido mientras la hoja se cierra con animación.
  const [ultima, setUltima] = useState(apertura)
  if (apertura && apertura !== ultima) setUltima(apertura)
  const a = apertura ?? ultima ?? {}
  const g = a.gasto ?? null
  const m = a.movimiento ?? null
  const titulo = g
    ? 'Editar gasto'
    : m
      ? m.tipo === 'ingreso'
        ? 'Editar ingreso'
        : m.tipo === 'ajuste'
          ? 'Editar ajuste de saldo'
          : 'Editar movimiento'
      : 'Nuevo registro'
  const clave = g?.id ?? m?.id ?? `${a.pestana ?? 'gasto'}-${JSON.stringify(a.preset ?? null)}`
  return (
    <Modal open={Boolean(apertura)} onClose={cerrar} title={titulo}>
      <Contenido key={clave} onClose={cerrar} gasto={g} movimiento={m} pestana={a.pestana} preset={a.preset ?? null} />
    </Modal>
  )
}

function Contenido({
  onClose,
  gasto,
  movimiento,
  pestana,
  preset,
}: {
  onClose: () => void
  gasto: Gasto | null
  movimiento: Movimiento | null
  pestana?: PestanaRegistro
  preset: Partial<Movimiento> | null
}) {
  const inicial: PestanaRegistro = gasto ? 'gasto' : movimiento ? (movimiento.tipo === 'ingreso' ? 'ingreso' : 'mover') : (pestana ?? 'gasto')
  const [tab, setTab] = useState<PestanaRegistro>(inicial)
  const editando = Boolean(gasto || movimiento)
  if (movimiento?.tipo === 'ajuste') return <FormAjuste onClose={onClose} movimiento={movimiento} />
  return (
    <div>
      {!editando && (
        <Segmented
          full
          className="mb-5"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'gasto', label: 'Gasto', icon: ShoppingBag },
            { id: 'ingreso', label: 'Ingreso', icon: ArrowDownLeft },
            { id: 'mover', label: 'Mover', icon: PiggyBank },
          ]}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
          {tab === 'gasto' && <FormGasto onClose={onClose} gasto={gasto} />}
          {tab === 'ingreso' && <FormIngreso onClose={onClose} movimiento={movimiento} />}
          {tab === 'mover' && <FormMover onClose={onClose} movimiento={movimiento} preset={preset} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ───────────────────────── Piezas comunes ───────────────────────── */

function useSaldos() {
  const s = useStore()
  return useMemo(() => {
    const r = resumenFondos(s, mesActual())
    return { fondos: Object.fromEntries(r.filas.map((f) => [f.fondo.id, f.saldo])) as Record<string, number>, sinAsignar: r.sinAsignar }
  }, [s])
}

function MontoInput({ value, onChange, moneda, tono = 'ink', permitirNegativo = false }: { value: string; onChange: (v: string) => void; moneda: string; tono?: 'ink' | 'ok' | 'bad'; permitirNegativo?: boolean }) {
  const color = tono === 'ok' ? 'text-ok' : tono === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <label className="block rounded-2xl bg-surface-2 px-4 pt-3 pb-2 focus-within:ring-4 focus-within:ring-primary/15 transition">
      <span className="text-[13px] font-semibold text-muted">Monto</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${color} opacity-60`}>{moneda}</span>
        <input
          className={`w-full min-w-0 bg-transparent outline-none num text-[40px] leading-[1.15] font-extrabold tracking-tight ${color} placeholder:text-muted/40`}
          inputMode={permitirNegativo ? 'text' : 'decimal'}
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={!window.matchMedia('(max-width: 767px)').matches}
          aria-label="Monto"
        />
      </div>
    </label>
  )
}

function FechaChips({ fecha, onChange }: { fecha: string; onChange: (f: string) => void }) {
  const hoy = hoyISO()
  const ayer = format(subDays(parseISO(hoy), 1), 'yyyy-MM-dd')
  const chip = (activo: boolean) =>
    `px-3.5 h-10 rounded-xl text-sm font-semibold border transition-colors ${activo ? 'bg-primary text-primary-ink border-transparent' : 'border-line bg-surface hover:bg-surface-2'}`
  return (
    <Field label="Fecha" grupo>
      <div className="flex gap-2">
        <button type="button" className={chip(fecha === hoy)} onClick={() => onChange(hoy)}>
          Hoy
        </button>
        <button type="button" className={chip(fecha === ayer)} onClick={() => onChange(ayer)}>
          Ayer
        </button>
        <input className="input !min-h-10 flex-1 min-w-0" type="date" value={fecha} onChange={(e) => onChange(e.target.value)} aria-label="Elegir fecha" />
      </div>
    </Field>
  )
}

function Chip({ activo, onClick, icono, children, nota, notaCls = '' }: { activo: boolean; onClick: () => void; icono?: ReactNode; children: ReactNode; nota?: ReactNode; notaCls?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-2 min-h-10 py-1 pl-2 pr-3.5 rounded-xl text-sm font-semibold border text-left transition-colors ${
        activo ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface hover:bg-surface-2'
      }`}
    >
      {icono}
      <span className="leading-tight">
        {children}
        {nota !== undefined && <span className={`block num text-[11px] font-medium ${activo ? 'text-primary/80' : 'text-muted'} ${notaCls}`}>{nota}</span>}
      </span>
    </button>
  )
}

function ChipsCuenta({ cuentas, value, onChange }: { cuentas: Cuenta[]; value: string; onChange: (id: string) => void }) {
  if (cuentas.length === 0) return <p className="text-sm text-muted">Crea tus cuentas en Ajustes.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {cuentas.map((c) => (
        <Chip key={c.id} activo={c.id === value} onClick={() => onChange(c.id)} icono={<IconBadge icon={ICONO_CUENTA[c.tipo]} size="sm" />}>
          {c.nombre}
        </Chip>
      ))}
    </div>
  )
}

/** Chips de fondos con su saldo. `conSinAsignar` agrega la opción "Sin asignar" (valor ''). */
function ChipsFondo({
  fondos,
  value,
  onChange,
  saldos,
  sinAsignar,
  conSinAsignar = false,
  mon,
}: {
  fondos: Fondo[]
  value: string
  onChange: (id: string) => void
  saldos: Record<string, number>
  sinAsignar?: number
  conSinAsignar?: boolean
  mon: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {conSinAsignar && (
        <Chip activo={value === ''} onClick={() => onChange('')} icono={<IconBadge icon={Inbox} size="sm" color="var(--muted)" />} nota={sinAsignar !== undefined ? money(sinAsignar, mon) : undefined} notaCls={sinAsignar !== undefined && sinAsignar < 0 ? '!text-bad' : ''}>
          Sin asignar
        </Chip>
      )}
      {fondos.map((f) => (
        <Chip key={f.id} activo={f.id === value} onClick={() => onChange(f.id)} icono={<IconBadge icon={iconoDe(f)} size="sm" color={f.tipo === 'ahorro' ? 'var(--ok)' : 'var(--primary)'} />} nota={money(saldos[f.id] ?? 0, mon)} notaCls={(saldos[f.id] ?? 0) < 0 ? '!text-bad' : ''}>
          {f.nombre}
        </Chip>
      ))}
    </div>
  )
}

function Pie({ validacion, aviso, children }: { validacion: string | null; aviso?: string | null; children: ReactNode }) {
  const texto = validacion ?? aviso ?? 'Listo para guardar'
  return (
    <div className="sticky -bottom-4 md:-bottom-5 -mx-4 md:-mx-5 -mb-4 md:-mb-5 px-4 md:px-5 pt-3 pb-4 md:pb-5 mt-4 bg-surface border-t border-line flex items-center justify-between gap-3 z-10">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={texto}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className={`text-[13px] font-semibold items-center gap-1.5 leading-tight ${validacion ? 'inline-flex text-muted' : aviso ? 'inline-flex text-warn' : 'hidden sm:inline-flex text-ok'}`}
        >
          {validacion ? <CircleAlert size={15} className="shrink-0" /> : aviso ? <TriangleAlert size={15} className="shrink-0" /> : <Check size={15} strokeWidth={3} />}
          {texto}
        </motion.p>
      </AnimatePresence>
      <div className="flex items-center gap-3 ml-auto">{children}</div>
    </div>
  )
}

function Sugerencias({ id, items }: { id: string; items: string[] }) {
  return (
    <datalist id={id}>
      {items.map((x) => (
        <option key={x} value={x} />
      ))}
    </datalist>
  )
}

/* ───────────────────────── Gasto ───────────────────────── */

function FormGasto({ onClose, gasto }: { onClose: () => void; gasto: Gasto | null }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const saldos = useSaldos()
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoyISO())
  const [categoriaId, setCategoriaId] = useState(gasto?.categoriaId ?? '')
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '')
  const [monto, setMonto] = useState(gasto ? String(gasto.monto).replace('.', ',') : '')
  const [metodoId, setMetodoId] = useState(gasto?.metodoId ?? s.metodos[0]?.id ?? '')
  const [cuentaId, setCuentaId] = useState(gasto?.cuentaId ?? '')
  const [fondoId, setFondoId] = useState(gasto?.fondoId ?? '')
  const [guardarOtro, setGuardarOtro] = useState(false)
  const [detalle, setDetalle] = useState(false)

  const montoN = num(monto)
  const fondo = s.fondos.find((f) => f.id === fondoId)
  const resumen = useMemo(() => resumenMes(s, mesDe(fecha || hoyISO())), [s, fecha])
  const fondosGasto = s.fondos.filter((f) => !f.archivado && f.tipo === 'gasto')
  const fondosAhorro = s.fondos.filter((f) => !f.archivado && f.tipo === 'ahorro')

  // Al elegir categoría, se proponen fondo, cuenta y método usados la última vez en esa categoría.
  const elegirCategoria = (id: string) => {
    setCategoriaId(id)
    vibrar(8)
    if (gasto) return
    const previo = s.gastos.filter((g) => g.categoriaId === id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    if (previo) {
      if (previo.fondoId && s.fondos.some((f) => f.id === previo.fondoId)) setFondoId(previo.fondoId)
      if (previo.cuentaId && s.cuentas.some((c) => c.id === previo.cuentaId)) setCuentaId(previo.cuentaId)
      if (previo.metodoId && s.metodos.some((m) => m.id === previo.metodoId)) setMetodoId(previo.metodoId)
    } else if (!fondoId && fondosGasto.length === 1) {
      setFondoId(fondosGasto[0].id)
      if (fondosGasto[0].cuentaId && !cuentaId) setCuentaId(fondosGasto[0].cuentaId)
    }
  }

  const elegirFondo = (id: string) => {
    setFondoId(id)
    const f = s.fondos.find((x) => x.id === id)
    if (f?.cuentaId && !cuentaId) setCuentaId(f.cuentaId)
  }

  const sugerencias = useMemo(() => {
    const set = new Set<string>()
    for (const g of [...s.gastos].reverse()) {
      if (categoriaId && g.categoriaId !== categoriaId) continue
      if (g.descripcion) set.add(g.descripcion)
      if (set.size >= 12) break
    }
    return [...set]
  }, [s.gastos, categoriaId])

  const impacto = useMemo(() => {
    const base = gasto ? { ...s, gastos: s.gastos.filter((g) => g.id !== gasto.id) } : s
    return impactoGasto(base, { fecha, categoriaId, monto: montoN, cuentaId: cuentaId || null, fondoId: fondoId || null })
  }, [s, gasto, fecha, categoriaId, montoN, cuentaId, fondoId])

  const validacion = !(montoN > 0)
    ? 'Ingresa el monto'
    : !fecha
      ? 'Falta la fecha'
      : !categoriaId
        ? 'Elige una categoría'
        : !fondoId
          ? 'Elige de qué fondo sale'
          : !cuentaId
            ? 'Elige la cuenta'
            : null
  const aviso = !validacion && fondo?.tipo === 'ahorro' ? `Este gasto sale de tus ahorros (${fondo.nombre})` : !validacion && impacto.saldoFondoDespues < 0 ? `El fondo ${fondo?.nombre} queda en negativo` : null

  const guardar = () => {
    if (validacion) return
    const datos = { fecha, categoriaId, descripcion: descripcion.trim(), monto: montoN, metodoId: metodoId || null, cuentaId: cuentaId || null, fondoId: fondoId || null }
    const cat = s.categorias.find((c) => c.id === categoriaId)?.nombre
    vibrar(18)
    if (gasto) {
      s.editarGasto(gasto.id, datos)
      toast('Gasto actualizado', { detalle: `${money(montoN, mon)} en ${cat}` })
      onClose()
      return
    }
    const id = s.agregarGasto(datos)
    toast('Gasto guardado', { detalle: `${money(montoN, mon)} en ${cat}`, accion: { texto: 'Deshacer', onClick: () => useStore.getState().eliminarGasto(id) }, duracion: 5000 })
    if (guardarOtro) {
      setDescripcion('')
      setMonto('')
    } else onClose()
  }

  const eliminar = async () => {
    if (!gasto) return
    if (!(await confirmar('¿Eliminar este gasto?', { texto: 'Podrás deshacerlo desde el aviso que aparece abajo.', aceptar: 'Eliminar', peligro: true }))) return
    s.eliminarGasto(gasto.id)
    toast('Gasto eliminado', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().agregarGasto(gasto) }, duracion: 5000 })
    onClose()
  }

  const tonoV = (v: number) => (v < 0 ? 'text-bad' : 'text-ok')

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <MontoInput value={monto} onChange={setMonto} moneda={mon} />

      <Field label="Categoría" grupo>
        <div className="grid grid-cols-3 min-[420px]:grid-cols-4 gap-2">
          {s.categorias.map((c) => {
            const Icono = iconoDe(c)
            const activo = categoriaId === c.id
            const disp = resumen.categorias.find((x) => x.categoria.id === c.id)?.disponible ?? 0
            return (
              <motion.button
                type="button"
                key={c.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => elegirCategoria(c.id)}
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-1.5 pt-3 pb-2 border-2 transition-colors text-center ${activo ? 'bg-surface' : 'border-transparent bg-surface-2 hover:bg-surface-3/60'}`}
                style={activo ? { borderColor: c.color } : undefined}
                aria-pressed={activo}
              >
                <IconBadge icon={Icono} color={c.color} solid={activo} />
                <span className="text-[12px] font-semibold leading-tight line-clamp-2">{c.nombre}</span>
                {c.presupuesto > 0 && <span className={`num text-[10.5px] font-semibold leading-none ${disp < 0 ? 'text-bad' : 'text-muted'}`}>{money(disp, '')}</span>}
                {activo && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full grid place-items-center text-white" style={{ background: c.color }}>
                    <Check size={11} strokeWidth={3.5} />
                  </motion.span>
                )}
              </motion.button>
            )
          })}
        </div>
      </Field>

      <Field label="Descripción">
        <input className="input" placeholder="¿En qué se gastó?" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} list="sugerencias-gasto" />
        <Sugerencias id="sugerencias-gasto" items={sugerencias} />
      </Field>

      <FechaChips fecha={fecha} onChange={setFecha} />

      <Field label="Sale del fondo" grupo>
        {fondosGasto.length + fondosAhorro.length === 0 ? (
          <p className="text-sm text-muted">Crea fondos en Ajustes.</p>
        ) : (
          <div className="space-y-2.5">
            <ChipsFondo fondos={fondosGasto} value={fondoId} onChange={elegirFondo} saldos={saldos.fondos} mon={mon} />
            {fondosAhorro.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted mb-1.5">De tus ahorros</p>
                <ChipsFondo fondos={fondosAhorro} value={fondoId} onChange={elegirFondo} saldos={saldos.fondos} mon={mon} />
              </div>
            )}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Cuenta" hint={fondo?.cuentaId ? `El fondo ${fondo.nombre} vive en ${s.cuentas.find((c) => c.id === fondo.cuentaId)?.nombre}` : undefined}>
          <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Elegir cuenta</option>
            {s.cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método de pago">
          <div className="relative">
            <IconoMetodo nombre={s.metodos.find((x) => x.id === metodoId)?.nombre ?? ''} />
            <select className="input !pl-10" value={metodoId} onChange={(e) => setMetodoId(e.target.value)}>
              {s.metodos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <div className="rounded-2xl border border-line overflow-hidden">
        <button type="button" onClick={() => setDetalle((d) => !d)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 transition-colors" aria-expanded={detalle}>
          <span className="text-sm font-bold">Cómo queda después</span>
          <motion.span animate={{ rotate: detalle ? 180 : 0 }}>
            <ChevronDown size={18} className="text-muted" />
          </motion.span>
        </button>
        <div className="grid grid-cols-3 gap-px bg-line border-t border-line">
          <Mini k="Categoría" v={money(impacto.disponibleCategoriaDespues, mon)} cls={tonoV(impacto.disponibleCategoriaDespues)} />
          <Mini k="Fondo" v={money(impacto.saldoFondoDespues, mon)} cls={tonoV(impacto.saldoFondoDespues)} />
          <Mini k="Cuenta" v={money(impacto.saldoCuentaDespues, mon)} cls={tonoV(impacto.saldoCuentaDespues)} />
        </div>
        <AnimatePresence initial={false}>
          {detalle && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
              <div className="px-4 py-3 text-sm space-y-1.5 border-t border-line">
                <Linea k="Presupuesto de la categoría (mes)" v={money(impacto.presupuestoCategoria, mon)} />
                <Linea k="Disponible en la categoría después" v={money(impacto.disponibleCategoriaDespues, mon)} cls={tonoV(impacto.disponibleCategoriaDespues)} />
                <Linea k="Saldo actual del fondo" v={money(impacto.saldoFondo, mon)} />
                <Linea k="Saldo del fondo después" v={money(impacto.saldoFondoDespues, mon)} cls={tonoV(impacto.saldoFondoDespues)} />
                <Linea k="Saldo actual de la cuenta" v={money(impacto.saldoCuenta, mon)} />
                <Linea k="Saldo de la cuenta después" v={money(impacto.saldoCuentaDespues, mon)} cls={tonoV(impacto.saldoCuentaDespues)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {gasto && (
        <button type="button" className="btn btn-danger w-full" onClick={eliminar}>
          Eliminar gasto
        </button>
      )}

      <Pie validacion={validacion} aviso={aviso}>
        {!gasto && (
          <label className="text-[13px] text-muted flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={guardarOtro} onChange={(e) => setGuardarOtro(e.target.checked)} /> Registrar otro
          </label>
        )}
        <button type="submit" className="btn btn-primary min-w-28" disabled={Boolean(validacion)}>
          {gasto ? 'Guardar cambios' : 'Guardar gasto'}
        </button>
      </Pie>
    </form>
  )
}

/* ───────────────────────── Ingreso ───────────────────────── */

const RE_SUELDO = /sueldo|salario|quincena|aguinaldo|honorario|pago mensual/i

/** Si un ingreso nuevo con esta descripción se reparte: lo último que elegiste para esa descripción o, si es un sueldo, sí. */
function distribuirPorDefecto(d: Datos, descripcion: string): boolean | null {
  const previo = [...d.movimientos].reverse().find((m) => m.tipo === 'ingreso' && m.descripcion.trim().toLowerCase() === descripcion.trim().toLowerCase())
  if (previo) return previo.distribuir !== false
  if (RE_SUELDO.test(descripcion)) return true
  return null
}

function FormIngreso({ onClose, movimiento }: { onClose: () => void; movimiento: Movimiento | null }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const abrirPagate = useUI((u) => u.abrirPagate)
  const fondos = s.fondos.filter((f) => !f.archivado)
  const [fecha, setFecha] = useState(movimiento?.fecha ?? hoyISO())
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? 'Sueldo')
  const [destino, setDestino] = useState(movimiento?.cuentaDestinoId ?? s.recurrentes.find((r) => r.tipo === 'ingreso' && r.cuentaId)?.cuentaId ?? '')
  const [monto, setMonto] = useState(movimiento ? String(movimiento.monto).replace('.', ',') : String(s.ajustes.ingresoMensual || ''))
  const [distribuir, setDistribuir] = useState(movimiento ? movimiento.distribuir !== false : true)
  const [tocado, setTocado] = useState(Boolean(movimiento))
  const porDefecto = useMemo(() => Object.fromEntries(fondos.map((f) => [f.id, f.porcentaje])), [fondos])
  const [reparto, setReparto] = useState<Record<string, string>>(() => {
    const base = movimiento?.reparto ?? porDefecto
    return Object.fromEntries(fondos.map((f) => [f.id, String(Math.round((base[f.id] ?? 0) * 1000) / 10).replace('.', ',')]))
  })
  const [fondoDestino, setFondoDestino] = useState(movimiento?.fondoDestinoId ?? '')
  const saldos = useSaldos()
  const montoN = num(monto)

  const repartoN = Object.fromEntries(Object.entries(reparto).map(([k, v]) => [k, num(v) / 100]))
  const personalizado = fondos.some((f) => Math.abs((repartoN[f.id] ?? 0) - f.porcentaje) > 0.0001)
  const totalPct = Object.values(repartoN).reduce((a, b) => a + b, 0)
  const montos = repartoIngreso(s, { tipo: 'ingreso', monto: montoN, distribuir, reparto: personalizado ? repartoN : null, fondoDestinoId: fondoDestino || null })
  const sinAsignar = montoN - Object.values(montos).reduce((a, b) => a + b, 0)

  const sugerencias = useMemo(() => [...new Set(s.movimientos.filter((m) => m.tipo === 'ingreso').map((m) => m.descripcion).filter(Boolean))].slice(-12), [s.movimientos])

  const cambiarDescripcion = (v: string) => {
    setDescripcion(v)
    if (tocado) return
    const def = distribuirPorDefecto(s, v)
    if (def !== null) setDistribuir(def)
  }

  const validacion = !(montoN > 0) ? 'Ingresa el monto' : !fecha ? 'Falta la fecha' : !destino ? 'Elige dónde lo recibes' : distribuir && totalPct > 1.0001 ? 'El reparto supera el 100%' : null

  const guardar = () => {
    if (validacion) return
    const datos: Omit<Movimiento, 'id'> = {
      fecha,
      tipo: 'ingreso',
      descripcion: descripcion.trim(),
      cuentaOrigenId: null,
      cuentaDestinoId: destino,
      monto: montoN,
      distribuir,
      reparto: distribuir ? Object.fromEntries(Object.entries(repartoN).filter(([, v]) => v > 0)) : null,
      fondoOrigenId: null,
      fondoDestinoId: distribuir ? null : fondoDestino || null,
      recurrenteId: movimiento?.recurrenteId ?? null,
    }
    vibrar(18)
    if (movimiento) {
      s.editarMovimiento(movimiento.id, datos)
      toast('Ingreso actualizado')
      onClose()
      return
    }
    const id = s.agregarMovimiento(datos)
    toast('Ingreso guardado', {
      detalle: distribuir ? `${money(montoN, mon)} repartido entre tus fondos` : `${money(montoN, mon)} sin repartir`,
      accion: { texto: 'Deshacer', onClick: () => useStore.getState().eliminarMovimiento(id) },
      duracion: 5000,
    })
    onClose()
    // Págate primero: si alguna meta necesita aportes este mes, se propone apartarlos ahora.
    // Solo si el dinero se repartió o quedó sin asignar (si va a un fondo concreto ya tiene destino).
    const pendientes = metas(useStore.getState()).filter((m) => m.faltaEsteMes > 0.5)
    if (pendientes.length > 0 && (distribuir || !fondoDestino)) setTimeout(() => abrirPagate(destino), 350)
  }

  const eliminar = async () => {
    if (!movimiento) return
    if (!(await confirmar('¿Eliminar este ingreso?', { aceptar: 'Eliminar', peligro: true }))) return
    s.eliminarMovimiento(movimiento.id)
    toast('Ingreso eliminado', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().agregarMovimiento(movimiento) }, duracion: 5000 })
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
      <MontoInput value={monto} onChange={setMonto} moneda={mon} tono="ok" />

      <Field label="Descripción">
        <input className="input" placeholder="Sueldo, venta, reembolso…" value={descripcion} onChange={(e) => cambiarDescripcion(e.target.value)} list="sugerencias-ingreso" />
        <Sugerencias id="sugerencias-ingreso" items={sugerencias} />
      </Field>

      <FechaChips fecha={fecha} onChange={setFecha} />

      <Field label="Lo recibes en" grupo>
        <ChipsCuenta cuentas={s.cuentas} value={destino} onChange={setDestino} />
      </Field>

      <div className="rounded-2xl border border-line p-4 space-y-4">
        <Switch
          checked={distribuir}
          onChange={(v) => {
            setDistribuir(v)
            setTocado(true)
          }}
          label="Repartir entre mis fondos"
          descripcion={distribuir ? 'Se reparte con los porcentajes de abajo. Puedes cambiarlos solo para este ingreso.' : 'Para reembolsos, préstamos o dinero que no quieres repartir.'}
        />
        <AnimatePresence mode="wait" initial={false}>
          {distribuir ? (
            <motion.div key="si" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              {fondos.length === 0 ? (
                <p className="text-sm text-muted">Crea fondos en Ajustes para repartir tus ingresos.</p>
              ) : (
                <ul className="space-y-2">
                  {fondos.map((f) => (
                    <li key={f.id} className="flex items-center gap-3">
                      <IconBadge icon={iconoDe(f)} size="sm" color={f.tipo === 'ahorro' ? 'var(--ok)' : 'var(--primary)'} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight truncate">{f.nombre}</p>
                        <p className="text-xs text-muted truncate">{s.cuentas.find((c) => c.id === f.cuentaId)?.nombre ?? 'Sin cuenta'}</p>
                      </div>
                      <div className="relative w-20 shrink-0">
                        <input
                          className="input !min-h-9 !py-1 text-right num !pr-6 text-sm"
                          inputMode="decimal"
                          value={reparto[f.id] ?? '0'}
                          onChange={(e) => setReparto((r) => ({ ...r, [f.id]: e.target.value }))}
                          aria-label={`Porcentaje para ${f.nombre}`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">%</span>
                      </div>
                      <span className="num font-bold text-sm w-24 text-right shrink-0">{money(montos[f.id] ?? 0, mon)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-line text-xs">
                <span className={totalPct > 1.0001 ? 'text-bad font-semibold' : 'text-muted'}>
                  Repartes {Math.round(totalPct * 1000) / 10}%{sinAsignar > 0.005 ? `, quedan ${money(sinAsignar, mon)} sin asignar` : ''}
                </span>
                {personalizado && (
                  <button type="button" className="font-bold text-primary inline-flex items-center gap-1" onClick={() => setReparto(Object.fromEntries(fondos.map((f) => [f.id, String(Math.round(f.porcentaje * 1000) / 10).replace('.', ',')])))}>
                    <RotateCcw size={12} /> Usar mis porcentajes
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="no" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <p className="text-[13px] font-semibold text-muted mb-1.5">¿Para qué es este dinero?</p>
              <ChipsFondo fondos={fondos} value={fondoDestino} onChange={setFondoDestino} saldos={saldos.fondos} sinAsignar={saldos.sinAsignar} conSinAsignar mon={mon} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {movimiento && (
        <button type="button" className="btn btn-danger w-full" onClick={eliminar}>
          Eliminar ingreso
        </button>
      )}

      <Pie validacion={validacion}>
        <button type="submit" className="btn btn-primary min-w-28" disabled={Boolean(validacion)}>
          {movimiento ? 'Guardar cambios' : 'Guardar ingreso'}
        </button>
      </Pie>
    </form>
  )
}

/* ───────────────────────── Mover dinero (apartar / transferir) ───────────────────────── */

function FormMover({ onClose, movimiento, preset }: { onClose: () => void; movimiento: Movimiento | null; preset: Partial<Movimiento> | null }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const saldos = useSaldos()
  const fondos = s.fondos.filter((f) => !f.archivado)
  const base = movimiento ?? preset ?? {}
  const [fecha, setFecha] = useState(base.fecha ?? hoyISO())
  const [descripcion, setDescripcion] = useState(base.descripcion ?? '')
  const [monto, setMonto] = useState(base.monto ? String(base.monto).replace('.', ',') : '')
  const [fondoO, setFondoO] = useState(base.fondoOrigenId ?? '')
  const [fondoD, setFondoD] = useState(base.fondoDestinoId ?? '')
  const [cuentaO, setCuentaO] = useState(base.cuentaOrigenId ?? (base.fondoOrigenId ? (s.fondos.find((f) => f.id === base.fondoOrigenId)?.cuentaId ?? '') : ''))
  const [cuentaD, setCuentaD] = useState(base.cuentaDestinoId ?? (base.fondoDestinoId ? (s.fondos.find((f) => f.id === base.fondoDestinoId)?.cuentaId ?? '') : ''))
  const montoN = num(monto)

  const elegirO = (id: string) => {
    setFondoO(id)
    const c = s.fondos.find((f) => f.id === id)?.cuentaId
    if (c) setCuentaO(c)
  }
  const elegirD = (id: string) => {
    setFondoD(id)
    const c = s.fondos.find((f) => f.id === id)?.cuentaId
    if (c) setCuentaD(c)
    if (!cuentaO && c && !fondoO) setCuentaO(c)
  }

  const nombreFondo = (id: string) => (id ? (s.fondos.find((f) => f.id === id)?.nombre ?? '') : 'Sin asignar')
  const nombreCuenta = (id: string) => s.cuentas.find((c) => c.id === id)?.nombre ?? ''
  const mismaCuenta = cuentaO && cuentaO === cuentaD
  const mismoFondo = fondoO === fondoD
  const disponible = fondoO ? (saldos.fondos[fondoO] ?? 0) + (movimiento?.fondoOrigenId === fondoO ? movimiento.monto : 0) : saldos.sinAsignar

  const validacion = !(montoN > 0)
    ? 'Ingresa el monto'
    : !fecha
      ? 'Falta la fecha'
      : !cuentaO
        ? 'Elige de qué cuenta sale'
        : !cuentaD
          ? 'Elige a qué cuenta va'
          : mismaCuenta && mismoFondo
            ? 'Elige un fondo o una cuenta distinta'
            : null
  const aviso = !validacion && montoN > disponible + 0.005 ? `${nombreFondo(fondoO)} solo tiene ${money(disponible, mon)}` : null

  const resumen = validacion
    ? null
    : mismaCuenta
      ? `Apartas ${money(montoN, mon)} de ${nombreFondo(fondoO)} a ${nombreFondo(fondoD)}. El dinero sigue en ${nombreCuenta(cuentaO)}.`
      : mismoFondo
        ? `Transfieres ${money(montoN, mon)} de ${nombreCuenta(cuentaO)} a ${nombreCuenta(cuentaD)}. Sigue siendo de ${nombreFondo(fondoO)}.`
        : `Transfieres ${money(montoN, mon)} de ${nombreCuenta(cuentaO)} a ${nombreCuenta(cuentaD)} y pasa de ${nombreFondo(fondoO)} a ${nombreFondo(fondoD)}.`

  const guardar = () => {
    if (validacion) return
    const desc = descripcion.trim() || (mismaCuenta ? `Aporte a ${nombreFondo(fondoD)}` : `De ${nombreCuenta(cuentaO)} a ${nombreCuenta(cuentaD)}`)
    const datos: Omit<Movimiento, 'id'> = {
      fecha,
      tipo: 'transferencia',
      descripcion: desc,
      cuentaOrigenId: cuentaO,
      cuentaDestinoId: cuentaD,
      monto: montoN,
      fondoOrigenId: fondoO || null,
      fondoDestinoId: fondoD || null,
      recurrenteId: null,
    }
    vibrar(18)
    if (movimiento) {
      s.editarMovimiento(movimiento.id, datos)
      toast('Movimiento actualizado')
    } else {
      const id = s.agregarMovimiento(datos)
      const meta = s.fondos.find((f) => f.id === fondoD)?.meta
      toast(meta ? `Apartaste ${money(montoN, mon)} para ${nombreFondo(fondoD)}` : 'Movimiento guardado', {
        detalle: resumen ?? undefined,
        accion: { texto: 'Deshacer', onClick: () => useStore.getState().eliminarMovimiento(id) },
        duracion: 5000,
      })
    }
    onClose()
  }

  const eliminar = async () => {
    if (!movimiento) return
    if (!(await confirmar('¿Eliminar este movimiento?', { aceptar: 'Eliminar', peligro: true }))) return
    s.eliminarMovimiento(movimiento.id)
    toast('Movimiento eliminado', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().agregarMovimiento(movimiento) }, duracion: 5000 })
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
      <MontoInput value={monto} onChange={setMonto} moneda={mon} />

      <div className="rounded-2xl border border-line p-4 space-y-3">
        <Field label="Sale de" grupo>
          <ChipsFondo fondos={fondos} value={fondoO} onChange={elegirO} saldos={saldos.fondos} sinAsignar={saldos.sinAsignar} conSinAsignar mon={mon} />
        </Field>
        <select className="input !min-h-10 text-sm" value={cuentaO} onChange={(e) => setCuentaO(e.target.value)} aria-label="Cuenta de origen">
          <option value="">Cuenta de origen</option>
          {s.cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              Desde {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-center -my-2">
        <span className="h-9 w-9 rounded-full bg-surface-2 grid place-items-center text-muted">
          <ArrowDown size={18} />
        </span>
      </div>

      <div className="rounded-2xl border border-line p-4 space-y-3">
        <Field label="Va a" grupo>
          <ChipsFondo fondos={fondos} value={fondoD} onChange={elegirD} saldos={saldos.fondos} sinAsignar={saldos.sinAsignar} conSinAsignar mon={mon} />
        </Field>
        <select className="input !min-h-10 text-sm" value={cuentaD} onChange={(e) => setCuentaD(e.target.value)} aria-label="Cuenta de destino">
          <option value="">Cuenta de destino</option>
          {s.cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              A {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {resumen && <p className="rounded-2xl bg-primary-soft/60 text-sm px-4 py-3 leading-snug">{resumen}</p>}

      <Field label="Descripción (opcional)">
        <input className="input" placeholder={mismaCuenta ? 'Aporte a la meta' : 'Motivo'} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>

      <FechaChips fecha={fecha} onChange={setFecha} />

      {movimiento && (
        <button type="button" className="btn btn-danger w-full" onClick={eliminar}>
          Eliminar movimiento
        </button>
      )}

      <Pie validacion={validacion} aviso={aviso}>
        <button type="submit" className="btn btn-primary min-w-28" disabled={Boolean(validacion)}>
          {movimiento ? 'Guardar cambios' : mismaCuenta ? 'Apartar' : 'Guardar'}
        </button>
      </Pie>
    </form>
  )
}

/* ───────────────────────── Ajuste de saldo ───────────────────────── */

function FormAjuste({ onClose, movimiento }: { onClose: () => void; movimiento: Movimiento }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const saldos = useSaldos()
  const [fecha, setFecha] = useState(movimiento.fecha)
  const [descripcion, setDescripcion] = useState(movimiento.descripcion)
  const [monto, setMonto] = useState(String(movimiento.monto).replace('.', ','))
  const [cuenta, setCuenta] = useState(movimiento.cuentaDestinoId ?? '')
  const [fondo, setFondo] = useState(movimiento.fondoDestinoId ?? '')
  const montoN = num(monto)
  const validacion = !montoN ? 'Ingresa el monto (negativo si resta)' : !cuenta ? 'Elige la cuenta' : null
  const guardar = () => {
    if (validacion) return
    s.editarMovimiento(movimiento.id, { fecha, descripcion, monto: montoN, cuentaDestinoId: cuenta, fondoDestinoId: fondo || null })
    toast('Ajuste actualizado')
    onClose()
  }
  const eliminar = async () => {
    if (!(await confirmar('¿Eliminar este ajuste?', { aceptar: 'Eliminar', peligro: true }))) return
    s.eliminarMovimiento(movimiento.id)
    toast('Ajuste eliminado', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().agregarMovimiento(movimiento) }, duracion: 5000 })
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
      <MontoInput value={monto} onChange={setMonto} moneda={mon} tono={montoN < 0 ? 'bad' : 'ok'} permitirNegativo />
      <p className="text-xs text-muted -mt-3">Positivo si el banco tenía más; negativo si tenía menos.</p>
      <Field label="Cuenta" grupo>
        <ChipsCuenta cuentas={s.cuentas} value={cuenta} onChange={setCuenta} />
      </Field>
      <Field label="Fondo que absorbe la diferencia" grupo>
        <ChipsFondo fondos={s.fondos} value={fondo} onChange={setFondo} saldos={saldos.fondos} sinAsignar={saldos.sinAsignar} conSinAsignar mon={mon} />
      </Field>
      <Field label="Descripción">
        <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>
      <FechaChips fecha={fecha} onChange={setFecha} />
      <button type="button" className="btn btn-danger w-full" onClick={eliminar}>
        Eliminar ajuste
      </button>
      <Pie validacion={validacion}>
        <button type="submit" className="btn btn-primary min-w-28" disabled={Boolean(validacion)}>
          Guardar cambios
        </button>
      </Pie>
    </form>
  )
}

/* ───────────────────────── Auxiliares ───────────────────────── */

function IconoMetodo({ nombre }: { nombre: string }) {
  return createElement(iconoMetodo(nombre), { size: 17, className: 'absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none' })
}

function Mini({ k, v, cls }: { k: string; v: string; cls: string }) {
  return (
    <div className="bg-surface px-3 py-2.5 min-w-0">
      <p className="text-[11px] text-muted">{k}</p>
      <p className={`num text-[13px] font-bold truncate ${cls}`}>{v}</p>
    </div>
  )
}

function Linea({ k, v, cls = '' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`num font-semibold ${cls}`}>{v}</span>
    </div>
  )
}
