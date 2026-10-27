import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, Check, ChevronDown, CircleAlert, ShoppingBag } from 'lucide-react'
import { createElement, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { impactoGasto, resumenMes } from '../lib/calc'
import { confirmar, toast, vibrar } from '../lib/feedback'
import { hoyISO, mesDe, money, num } from '../lib/format'
import { ICONO_CUENTA, iconoDe, iconoMetodo } from '../lib/iconos'
import type { Gasto, Movimiento } from '../types'
import { Field, IconBadge, Modal, Segmented } from './ui'
import { format, subDays } from 'date-fns'

type Pestana = 'gasto' | 'ingreso' | 'transferencia'

export function Registrar({
  open,
  onClose,
  gasto,
  movimiento,
}: {
  open: boolean
  onClose: () => void
  /** Si se pasa, se edita ese gasto. */
  gasto?: Gasto | null
  movimiento?: Movimiento | null
}) {
  // Conserva los últimos valores mientras la hoja se cierra con animación.
  const [ultimo, setUltimo] = useState<{ gasto: Gasto | null; movimiento: Movimiento | null }>({ gasto: null, movimiento: null })
  if (open && (ultimo.gasto !== (gasto ?? null) || ultimo.movimiento !== (movimiento ?? null))) {
    setUltimo({ gasto: gasto ?? null, movimiento: movimiento ?? null })
  }
  const g = open ? (gasto ?? null) : ultimo.gasto
  const m = open ? (movimiento ?? null) : ultimo.movimiento
  const titulo = g ? 'Editar gasto' : m ? (m.tipo === 'ingreso' ? 'Editar ingreso' : 'Editar transferencia') : 'Nuevo registro'
  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      <Contenido onClose={onClose} gasto={g} movimiento={m} />
    </Modal>
  )
}

function Contenido({ onClose, gasto, movimiento }: { onClose: () => void; gasto: Gasto | null; movimiento: Movimiento | null }) {
  const inicial: Pestana = gasto ? 'gasto' : movimiento ? movimiento.tipo : 'gasto'
  const [tab, setTab] = useState<Pestana>(inicial)
  const editando = Boolean(gasto || movimiento)
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
            { id: 'transferencia', label: 'Transferir', icon: ArrowLeftRight },
          ]}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
          {tab === 'gasto' ? <FormGasto onClose={onClose} gasto={gasto} /> : <FormMovimiento onClose={onClose} tipo={tab} movimiento={movimiento} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ───────────────────────── Piezas comunes ───────────────────────── */

function MontoInput({ value, onChange, moneda, tono = 'ink' }: { value: string; onChange: (v: string) => void; moneda: string; tono?: 'ink' | 'ok' | 'bad' }) {
  const color = tono === 'ok' ? 'text-ok' : tono === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <label className="block rounded-2xl bg-surface-2 px-4 pt-3 pb-2 focus-within:ring-4 focus-within:ring-primary/15 transition">
      <span className="text-[13px] font-semibold text-muted">Monto</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${color} opacity-60`}>{moneda}</span>
        <input
          className={`w-full bg-transparent outline-none num text-[40px] leading-[1.15] font-extrabold tracking-tight ${color} placeholder:text-muted/40`}
          inputMode="decimal"
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
  const ayer = format(subDays(new Date(), 1), 'yyyy-MM-dd')
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

function Chips<T extends { id: string; nombre: string }>({
  items,
  value,
  onChange,
  icono,
  vacio,
}: {
  items: T[]
  value: string
  onChange: (id: string) => void
  icono: (x: T) => ReactNode
  vacio?: string
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{vacio}</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => {
        const activo = x.id === value
        return (
          <button
            type="button"
            key={x.id}
            onClick={() => onChange(x.id)}
            className={`inline-flex items-center gap-2 h-10 pl-2 pr-3.5 rounded-xl text-sm font-semibold border transition-colors ${
              activo ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface hover:bg-surface-2'
            }`}
          >
            {icono(x)}
            {x.nombre}
          </button>
        )
      })}
    </div>
  )
}

function Pie({ validacion, children }: { validacion: string | null; children: ReactNode }) {
  return (
    <div className="sticky -bottom-4 md:-bottom-5 -mx-4 md:-mx-5 -mb-4 md:-mb-5 px-4 md:px-5 pt-3 pb-4 md:pb-5 mt-4 bg-surface border-t border-line flex items-center justify-between gap-3 z-10">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={validacion ?? 'ok'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className={`text-[13px] font-semibold items-center gap-1.5 leading-tight ${validacion ? 'inline-flex text-muted' : 'hidden sm:inline-flex text-ok'}`}
        >
          {validacion ? <CircleAlert size={15} /> : <Check size={15} strokeWidth={3} />}
          {validacion ?? 'Listo para guardar'}
        </motion.p>
      </AnimatePresence>
      <div className="flex items-center gap-3 ml-auto">{children}</div>
    </div>
  )
}

/* ───────────────────────── Gasto ───────────────────────── */

function FormGasto({ onClose, gasto }: { onClose: () => void; gasto: Gasto | null }) {
  const s = useStore()
  const mon = s.ajustes.moneda
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
    }
  }

  // Si el fondo vive en una cuenta y no se eligió cuenta, sugerirla.
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
          ? 'Elige el fondo'
          : !cuentaId
            ? 'Elige la cuenta'
            : null

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
    toast('Gasto guardado', {
      detalle: `${money(montoN, mon)} en ${cat}`,
      accion: { texto: 'Deshacer', onClick: () => useStore.getState().eliminarGasto(id) },
      duracion: 5000,
    })
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
                className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-1.5 pt-3 pb-2 border-2 transition-colors text-center ${
                  activo ? 'bg-surface' : 'border-transparent bg-surface-2 hover:bg-surface-3/60'
                }`}
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
        <datalist id="sugerencias-gasto">
          {sugerencias.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </Field>

      <FechaChips fecha={fecha} onChange={setFecha} />

      <Field label="Sale del fondo" grupo>
        <Chips items={s.fondos} value={fondoId} onChange={elegirFondo} icono={(f) => <IconBadge icon={iconoDe(f)} size="sm" />} vacio="Crea fondos en Ajustes." />
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

      {/* Impacto */}
      <div className="rounded-2xl border border-line overflow-hidden">
        <button type="button" onClick={() => setDetalle((d) => !d)} className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 transition-colors" aria-expanded={detalle}>
          <span className="text-sm font-bold">Cómo queda después</span>
          <motion.span animate={{ rotate: detalle ? 180 : 0 }}>
            <ChevronDown size={18} className="text-muted" />
          </motion.span>
        </button>
        <div className="grid grid-cols-3 gap-px bg-line border-t border-line">
          <Mini k="Categoría" v={money(impacto.disponibleCategoriaDespues, mon)} cls={tonoV(impacto.disponibleCategoriaDespues)} />
          <Mini k="Cuenta" v={money(impacto.saldoCuentaDespues, mon)} cls={tonoV(impacto.saldoCuentaDespues)} />
          <Mini k="Fondo" v={money(impacto.saldoFondoDespues, mon)} cls={tonoV(impacto.saldoFondoDespues)} />
        </div>
        <AnimatePresence initial={false}>
          {detalle && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
              <div className="px-4 py-3 text-sm space-y-1.5 border-t border-line">
                <Linea k="Presupuesto de la categoría (mes)" v={money(impacto.presupuestoCategoria, mon)} />
                <Linea k="Disponible en la categoría después" v={money(impacto.disponibleCategoriaDespues, mon)} cls={tonoV(impacto.disponibleCategoriaDespues)} />
                <Linea k="Saldo actual de la cuenta" v={money(impacto.saldoCuenta, mon)} />
                <Linea k="Saldo de la cuenta después" v={money(impacto.saldoCuentaDespues, mon)} cls={tonoV(impacto.saldoCuentaDespues)} />
                <Linea k="Saldo del fondo en el mes" v={money(impacto.saldoFondoMes, mon)} />
                <Linea k="Saldo del fondo después" v={money(impacto.saldoFondoDespues, mon)} cls={tonoV(impacto.saldoFondoDespues)} />
                <Linea k="Saldo efectivo neto del mes después" v={money(impacto.saldoNetoDespues, mon)} cls={tonoV(impacto.saldoNetoDespues)} />
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

      <Pie validacion={validacion}>
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

/* ───────────────────────── Ingreso / transferencia ───────────────────────── */

function FormMovimiento({ onClose, tipo, movimiento }: { onClose: () => void; tipo: 'ingreso' | 'transferencia'; movimiento: Movimiento | null }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const [fecha, setFecha] = useState(movimiento?.fecha ?? hoyISO())
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? (tipo === 'ingreso' ? 'Sueldo' : ''))
  const [origen, setOrigen] = useState(movimiento?.cuentaOrigenId ?? '')
  const [destino, setDestino] = useState(movimiento?.cuentaDestinoId ?? '')
  const [monto, setMonto] = useState(movimiento ? String(movimiento.monto).replace('.', ',') : tipo === 'ingreso' ? String(s.ajustes.ingresoMensual || '') : '')
  const montoN = num(monto)
  const esTransf = tipo === 'transferencia'

  const validacion = !(montoN > 0)
    ? 'Ingresa el monto'
    : !fecha
      ? 'Falta la fecha'
      : esTransf && !origen
        ? 'Elige de qué cuenta sale'
        : !destino
          ? esTransf
            ? 'Elige a qué cuenta va'
            : 'Elige dónde lo recibes'
          : esTransf && origen === destino
            ? 'Origen y destino son la misma cuenta'
            : null

  const distribucion = useMemo(
    () =>
      s.fondos.map((f) => ({
        f,
        monto: montoN * f.porcentaje,
        cuenta: s.cuentas.find((c) => c.id === f.cuentaId)?.nombre ?? 'sin cuenta',
      })),
    [s.fondos, s.cuentas, montoN],
  )

  const guardar = () => {
    if (validacion) return
    const datos = { fecha, tipo, descripcion: descripcion.trim(), cuentaOrigenId: esTransf ? origen : null, cuentaDestinoId: destino, monto: montoN }
    const nombre = esTransf ? 'Transferencia' : 'Ingreso'
    vibrar(18)
    if (movimiento) {
      s.editarMovimiento(movimiento.id, datos)
      toast(`${nombre} actualizado`)
    } else {
      const id = s.agregarMovimiento(datos)
      toast(`${nombre} guardado`, {
        detalle: money(montoN, mon),
        accion: { texto: 'Deshacer', onClick: () => useStore.getState().eliminarMovimiento(id) },
        duracion: 5000,
      })
    }
    onClose()
  }

  const eliminar = async () => {
    if (!movimiento) return
    if (!(await confirmar('¿Eliminar este registro?', { aceptar: 'Eliminar', peligro: true }))) return
    s.eliminarMovimiento(movimiento.id)
    toast('Registro eliminado', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().agregarMovimiento(movimiento) }, duracion: 5000 })
    onClose()
  }

  const iconoCuenta = (c: (typeof s.cuentas)[number]) => <IconBadge icon={ICONO_CUENTA[c.tipo]} size="sm" />

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <MontoInput value={monto} onChange={setMonto} moneda={mon} tono={esTransf ? 'ink' : 'ok'} />

      <Field label="Descripción">
        <input className="input" placeholder={esTransf ? 'Motivo de la transferencia' : 'Sueldo, extra, venta…'} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>

      <FechaChips fecha={fecha} onChange={setFecha} />

      {esTransf && (
        <Field label="Sale de" grupo>
          <Chips items={s.cuentas} value={origen} onChange={setOrigen} icono={iconoCuenta} vacio="Crea cuentas en Ajustes." />
        </Field>
      )}
      <Field label={esTransf ? 'Va a' : 'Lo recibes en'} grupo>
        <Chips items={s.cuentas} value={destino} onChange={setDestino} icono={iconoCuenta} vacio="Crea cuentas en Ajustes." />
      </Field>

      {!esTransf && distribucion.length > 0 && (
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="text-sm font-bold mb-3">Así se reparte entre tus fondos</p>
          <ul className="space-y-2.5">
            {distribucion.map(({ f, monto: m, cuenta }) => (
              <li key={f.id} className="flex items-center gap-3">
                <IconBadge icon={iconoDe(f)} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">
                    {f.nombre} <span className="text-muted font-medium">{Math.round(f.porcentaje * 100)}%</span>
                  </p>
                  <p className="text-xs text-muted inline-flex items-center gap-1">
                    <ArrowRight size={11} /> {cuenta}
                  </p>
                </div>
                <span className="num font-bold text-sm">{money(m, mon)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted mt-3 leading-relaxed">
            Registra el ingreso en la cuenta donde lo recibes y luego mueve cada parte con una transferencia. En Cuentas verás cuánto falta mover.
          </p>
        </div>
      )}

      {movimiento && (
        <button type="button" className="btn btn-danger w-full" onClick={eliminar}>
          Eliminar registro
        </button>
      )}

      <Pie validacion={validacion}>
        <button type="submit" className="btn btn-primary min-w-28" disabled={Boolean(validacion)}>
          {movimiento ? 'Guardar cambios' : esTransf ? 'Guardar transferencia' : 'Guardar ingreso'}
        </button>
      </Pie>
    </form>
  )
}

function IconoMetodo({ nombre }: { nombre: string }) {
  const props = { size: 17, className: 'absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none' }
  return createElement(iconoMetodo(nombre), props)
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
