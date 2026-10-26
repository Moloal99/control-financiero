import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { impactoGasto, resumenFondos } from '../lib/calc'
import { hoyISO, mesDe, money, num } from '../lib/format'
import type { Gasto, Movimiento } from '../types'
import { Field, Modal } from './ui'

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
  const inicial: Pestana = gasto ? 'gasto' : movimiento ? movimiento.tipo : 'gasto'
  const [tab, setTab] = useState<Pestana>(inicial)
  const editando = Boolean(gasto || movimiento)
  const titulo = gasto ? 'Editar gasto' : movimiento ? 'Editar movimiento' : 'Registrar'
  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      {!editando && (
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2 mb-4">
          {(['gasto', 'ingreso', 'transferencia'] as Pestana[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'bg-surface shadow text-primary' : 'text-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {tab === 'gasto' ? (
        <FormGasto key={gasto?.id ?? 'nuevo'} onClose={onClose} gasto={gasto ?? null} />
      ) : (
        <FormMovimiento key={movimiento?.id ?? tab} onClose={onClose} tipo={tab} movimiento={movimiento ?? null} />
      )}
    </Modal>
  )
}

function FormGasto({ onClose, gasto }: { onClose: () => void; gasto: Gasto | null }) {
  const s = useStore()
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoyISO())
  const [categoriaId, setCategoriaId] = useState(gasto?.categoriaId ?? '')
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '')
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '')
  const [metodoId, setMetodoId] = useState(gasto?.metodoId ?? s.metodos[0]?.id ?? '')
  const [cuentaId, setCuentaId] = useState(gasto?.cuentaId ?? '')
  const [fondoId, setFondoId] = useState(gasto?.fondoId ?? '')
  const [guardarOtro, setGuardarOtro] = useState(false)
  const [ok, setOk] = useState<string | null>(null)

  const montoN = num(monto)
  const fondo = s.fondos.find((f) => f.id === fondoId)

  // Si el fondo vive en una cuenta y no se eligió cuenta, sugerirla.
  const elegirFondo = (id: string) => {
    setFondoId(id)
    const f = s.fondos.find((x) => x.id === id)
    if (f?.cuentaId && !cuentaId) setCuentaId(f.cuentaId)
  }

  const impacto = useMemo(() => {
    const base = gasto ? { ...s, gastos: s.gastos.filter((g) => g.id !== gasto.id) } : s
    return impactoGasto(base, { fecha, categoriaId, monto: montoN, cuentaId: cuentaId || null, fondoId: fondoId || null })
  }, [s, gasto, fecha, categoriaId, montoN, cuentaId, fondoId])

  const validacion = !fecha
    ? 'Falta la fecha'
    : !categoriaId
      ? 'Elige una categoría'
      : !(montoN > 0)
        ? 'Ingresa el monto'
        : !cuentaId
          ? 'Elige la cuenta'
          : !fondoId
            ? 'Elige el fondo'
            : null

  const guardar = () => {
    if (validacion) return
    const datos = { fecha, categoriaId, descripcion: descripcion.trim(), monto: montoN, metodoId: metodoId || null, cuentaId: cuentaId || null, fondoId: fondoId || null }
    if (gasto) s.editarGasto(gasto.id, datos)
    else s.agregarGasto(datos)
    if (guardarOtro && !gasto) {
      setOk(`Guardado: ${money(montoN, s.ajustes.moneda)} en ${s.categorias.find((c) => c.id === categoriaId)?.nombre}`)
      setDescripcion('')
      setMonto('')
      setTimeout(() => setOk(null), 2500)
    } else onClose()
  }

  const neg = (v: number) => (v < 0 ? 'text-bad' : '')

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto (Bs)">
          <input className="input text-lg font-bold" inputMode="decimal" placeholder="0,00" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
        </Field>
        <Field label="Fecha">
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </div>
      <Field label="Categoría">
        <div className="flex flex-wrap gap-1.5">
          {s.categorias.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategoriaId(c.id)}
              className={`pill !py-1.5 !px-3 !text-sm border transition ${categoriaId === c.id ? 'text-white dark:text-[#03201c] border-transparent' : 'border-line bg-surface'}`}
              style={categoriaId === c.id ? { background: c.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: categoriaId === c.id ? 'rgba(255,255,255,.7)' : c.color }} />
              {c.nombre}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Descripción">
        <input className="input" placeholder="¿En qué se gastó?" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Fondo">
          <select className="input" value={fondoId} onChange={(e) => elegirFondo(e.target.value)}>
            <option value="">Elegir…</option>
            {s.fondos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cuenta" hint={fondo?.cuentaId ? `El fondo vive en ${s.cuentas.find((c) => c.id === fondo.cuentaId)?.nombre}` : undefined}>
          <select className="input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Elegir…</option>
            {s.cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método de pago">
          <select className="input" value={metodoId} onChange={(e) => setMetodoId(e.target.value)}>
            {s.metodos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-xl bg-surface-2 p-3 text-sm space-y-1">
        <p className="font-semibold mb-1">Impacto de este gasto · {mesDe(fecha || hoyISO())}</p>
        <Linea k="Presupuesto de la categoría (mes)" v={money(impacto.presupuestoCategoria)} />
        <Linea k="Disponible en la categoría después" v={money(impacto.disponibleCategoriaDespues)} cls={neg(impacto.disponibleCategoriaDespues)} />
        <Linea k="Saldo actual de la cuenta" v={money(impacto.saldoCuenta)} />
        <Linea k="Saldo de la cuenta después" v={money(impacto.saldoCuentaDespues)} cls={neg(impacto.saldoCuentaDespues)} />
        <Linea k="Saldo del fondo en el mes" v={money(impacto.saldoFondoMes)} />
        <Linea k="Saldo del fondo después" v={money(impacto.saldoFondoDespues)} cls={neg(impacto.saldoFondoDespues)} />
        <Linea k="Saldo efectivo neto (mes) después" v={money(impacto.saldoNetoDespues)} cls={neg(impacto.saldoNetoDespues)} />
      </div>

      {ok && <p className="text-sm text-ok font-medium">{ok}</p>}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className={`text-sm ${validacion ? 'text-warn' : 'text-ok'}`}>{validacion ? `⚠ ${validacion}` : '✔ Listo para guardar'}</p>
        <div className="flex items-center gap-2">
          {!gasto && (
            <label className="text-xs text-muted flex items-center gap-1">
              <input type="checkbox" checked={guardarOtro} onChange={(e) => setGuardarOtro(e.target.checked)} /> y otro
            </label>
          )}
          <button type="submit" className="btn btn-primary" disabled={Boolean(validacion)}>
            Guardar
          </button>
        </div>
      </div>
    </form>
  )
}

function FormMovimiento({ onClose, tipo, movimiento }: { onClose: () => void; tipo: 'ingreso' | 'transferencia'; movimiento: Movimiento | null }) {
  const s = useStore()
  const [fecha, setFecha] = useState(movimiento?.fecha ?? hoyISO())
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? (tipo === 'ingreso' ? 'Sueldo' : ''))
  const [origen, setOrigen] = useState(movimiento?.cuentaOrigenId ?? '')
  const [destino, setDestino] = useState(movimiento?.cuentaDestinoId ?? '')
  const [monto, setMonto] = useState(movimiento ? String(movimiento.monto) : tipo === 'ingreso' ? String(s.ajustes.ingresoMensual || '') : '')
  const montoN = num(monto)
  const esTransf = tipo === 'transferencia'

  const validacion = !fecha
    ? 'Falta la fecha'
    : !destino
      ? 'Elige la cuenta destino'
      : esTransf && !origen
        ? 'Elige la cuenta origen'
        : esTransf && origen === destino
          ? 'Origen y destino son iguales'
          : !(montoN > 0)
            ? 'Ingresa el monto'
            : null

  const distribucion = useMemo(() => {
    const fondos = resumenFondos(s, mesDe(fecha || hoyISO()))
    return s.fondos.map((f) => ({
      f,
      monto: montoN * f.porcentaje,
      cuenta: s.cuentas.find((c) => c.id === f.cuentaId)?.nombre ?? '?',
      yaAsignado: fondos.filas.find((x) => x.fondo.id === f.id)?.asignado ?? 0,
    }))
  }, [s, montoN, fecha])

  const guardar = () => {
    if (validacion) return
    const datos = { fecha, tipo, descripcion: descripcion.trim(), cuentaOrigenId: esTransf ? origen : null, cuentaDestinoId: destino, monto: montoN }
    if (movimiento) s.editarMovimiento(movimiento.id, datos)
    else s.agregarMovimiento(datos)
    onClose()
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto (Bs)">
          <input className="input text-lg font-bold" inputMode="decimal" placeholder="0,00" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
        </Field>
        <Field label="Fecha">
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </div>
      <Field label="Descripción">
        <input className="input" placeholder={esTransf ? 'Motivo de la transferencia' : 'Sueldo, extra, venta…'} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {esTransf && (
          <Field label="Cuenta origen">
            <select className="input" value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="">Elegir…</option>
              {s.cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Cuenta destino" className={esTransf ? '' : 'col-span-2'}>
          <select className="input" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Elegir…</option>
            {s.cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!esTransf && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm space-y-1">
          <p className="font-semibold mb-1">Así se distribuirá este ingreso</p>
          {distribucion.map(({ f, monto: m, cuenta }) => (
            <Linea key={f.id} k={`${f.nombre} (${Math.round(f.porcentaje * 100)}%) → ${cuenta}`} v={money(m)} />
          ))}
          <p className="text-xs text-muted pt-1">
            Registra el ingreso en la cuenta donde lo recibes y luego usa transferencias para mover cada parte a su cuenta. La pestaña Cuentas te muestra lo pendiente.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className={`text-sm ${validacion ? 'text-warn' : 'text-ok'}`}>{validacion ? `⚠ ${validacion}` : '✔ Listo para guardar'}</p>
        <button type="submit" className="btn btn-primary" disabled={Boolean(validacion)}>
          Guardar
        </button>
      </div>
    </form>
  )
}

function Linea({ k, v, cls = '' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className={`num font-medium ${cls}`}>{v}</span>
    </div>
  )
}
