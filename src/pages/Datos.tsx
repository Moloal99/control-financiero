import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownLeft, ArrowLeftRight, CalendarRange, CircleAlert, CloudUpload, Database, Download, FileJson, FileSpreadsheet,
  FileText, LoaderCircle, RotateCcw, ShoppingBag, Sparkles, TriangleAlert, Upload, X,
} from 'lucide-react'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { exportarDatos, useStore } from '../store'
import { confirmar, toast, vibrar } from '../lib/feedback'
import { fechaCorta, hoyISO, money, nombreMes } from '../lib/format'
import type { ModoImport, ResultadoImportacion } from '../lib/excel'
import { Card, Field, IconBadge, Segmented } from '../components/ui'

type Rango = 'todo' | 'mes' | 'anio' | 'personalizado'
type Formato = 'xlsx' | 'csv'

const ACEPTA = '.xlsx,.xlsm,.xls,.csv,.json'

export function Datos({ mes }: { mes: string }) {
  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-start">
        <Exportar mes={mes} />
        <Importar />
      </div>
      <Respaldo />
    </div>
  )
}

/* ───────────────────────── Exportar ───────────────────────── */

function Exportar({ mes }: { mes: string }) {
  const s = useStore()
  const [rango, setRango] = useState<Rango>('todo')
  const [formato, setFormato] = useState<Formato>('xlsx')
  const [desde, setDesde] = useState(`${mes}-01`)
  const [hasta, setHasta] = useState(hoyISO())
  const [ocupado, setOcupado] = useState(false)

  const limites = useMemo((): { desde?: string; hasta?: string; etiqueta: string } => {
    if (rango === 'mes') return { desde: `${mes}-01`, hasta: `${mes}-31`, etiqueta: nombreMes(mes) }
    if (rango === 'anio') return { desde: `${mes.slice(0, 4)}-01-01`, hasta: `${mes.slice(0, 4)}-12-31`, etiqueta: `Año ${mes.slice(0, 4)}` }
    if (rango === 'personalizado') return { desde, hasta, etiqueta: `${fechaCorta(desde)} a ${fechaCorta(hasta)}` }
    return { etiqueta: 'Todo el historial' }
  }, [rango, mes, desde, hasta])

  const enRango = (f: string) => (!limites.desde || f >= limites.desde) && (!limites.hasta || f <= limites.hasta)
  const nGastos = s.gastos.filter((g) => enRango(g.fecha)).length
  const nMovs = s.movimientos.filter((m) => enRango(m.fecha)).length

  const descargarArchivo = async () => {
    setOcupado(true)
    try {
      const lib = await import('../lib/excel')
      const opciones = { desde: limites.desde, hasta: limites.hasta, titulo: `Control Financiero, ${limites.etiqueta}` }
      const sufijo = rango === 'todo' ? hoyISO() : rango === 'mes' ? mes : rango === 'anio' ? mes.slice(0, 4) : `${desde}_a_${hasta}`
      if (formato === 'xlsx') lib.descargar(await lib.exportarExcel(exportarDatos(s), opciones), `control-financiero-${sufijo}.xlsx`)
      else lib.descargar(lib.exportarCSV(exportarDatos(s), opciones), `control-financiero-${sufijo}.csv`)
      vibrar(15)
      toast(formato === 'xlsx' ? 'Excel descargado' : 'CSV descargado', { detalle: `${nGastos} gastos y ${nMovs} movimientos, ${limites.etiqueta.toLowerCase()}` })
    } catch (e) {
      toast('No se pudo generar el archivo', { tono: 'bad', detalle: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Card icon={Download} title="Descargar mis datos" subtitle="Un Excel con formato, listo para filtrar, sumar o compartir">
      <div className="space-y-4">
        <Field label="Qué período" grupo>
          <Segmented
            full
            size="sm"
            value={rango}
            onChange={setRango}
            options={[
              { id: 'todo', label: 'Todo' },
              { id: 'mes', label: 'Mes' },
              { id: 'anio', label: 'Año' },
              { id: 'personalizado', label: 'Fechas', icon: CalendarRange },
            ]}
          />
        </Field>
        <AnimatePresence initial={false}>
          {rango === 'personalizado' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-3 pb-1">
                <Field label="Desde">
                  <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </Field>
                <Field label="Hasta">
                  <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </Field>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Field label="Formato" grupo>
          <div className="grid grid-cols-2 gap-2">
            <OpcionFormato activo={formato === 'xlsx'} onClick={() => setFormato('xlsx')} icono={FileSpreadsheet} titulo="Excel" texto="Hojas con formato, resumen y configuración" />
            <OpcionFormato activo={formato === 'csv'} onClick={() => setFormato('csv')} icono={FileText} titulo="CSV" texto="Texto plano para otros programas" />
          </div>
        </Field>

        <div className="rounded-2xl bg-surface-2 px-4 py-3 flex items-center gap-3">
          <IconBadge icon={Database} size="sm" color="var(--ok)" />
          <p className="text-sm flex-1">
            <b>{limites.etiqueta}</b>
            <span className="text-muted">
              {': '}
              <span className="num">{nGastos}</span> gastos y <span className="num">{nMovs}</span> ingresos o transferencias
            </span>
          </p>
        </div>

        <button className="btn btn-primary w-full" onClick={descargarArchivo} disabled={ocupado || (rango === 'personalizado' && desde > hasta)}>
          {ocupado ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}
          {formato === 'xlsx' ? 'Descargar Excel' : 'Descargar CSV'}
        </button>
        {formato === 'xlsx' && <p className="text-xs text-muted leading-relaxed">Incluye las hojas Resumen, Registro, Movimientos, Presupuesto, Cuentas, Distribución, Métodos de pago y Ajustes. Puedes volver a importarlo aquí mismo.</p>}
      </div>
    </Card>
  )
}

function OpcionFormato({ activo, onClick, icono: Icono, titulo, texto }: { activo: boolean; onClick: () => void; icono: typeof FileText; titulo: string; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`text-left rounded-2xl border-2 p-3 transition-colors ${activo ? 'border-primary bg-primary-soft/60' : 'border-line hover:bg-surface-2'}`}
    >
      <Icono size={20} className={activo ? 'text-primary' : 'text-muted'} />
      <p className="font-bold mt-1.5 text-sm">{titulo}</p>
      <p className="text-xs text-muted leading-snug mt-0.5">{texto}</p>
    </button>
  )
}

/* ───────────────────────── Importar ───────────────────────── */

function Importar() {
  const s = useStore()
  const input = useRef<HTMLInputElement>(null)
  const [modo, setModo] = useState<ModoImport>('combinar')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  const analizar = async (f: File, m: ModoImport = modo) => {
    setArchivo(f)
    setError(null)
    setResultado(null)
    setCargando(true)
    try {
      const { analizarArchivo } = await import('../lib/excel')
      setResultado(await analizarArchivo(f, exportarDatos(useStore.getState()), m))
    } catch (e) {
      setError(`No pude leer "${f.name}". ${(e as Error).message || 'Revisa que sea un Excel, CSV o respaldo JSON.'}`)
    } finally {
      setCargando(false)
    }
  }

  const cambiarModo = (m: ModoImport) => {
    setModo(m)
    if (archivo) analizar(archivo, m)
  }

  const cancelar = () => {
    setArchivo(null)
    setResultado(null)
    setError(null)
  }

  const aplicar = async () => {
    if (!resultado) return
    if (modo === 'reemplazar' && !(await confirmar('¿Reemplazar todos tus datos?', { texto: 'Se borrarán los registros y la configuración actuales y se usarán los del archivo. Podrás deshacerlo justo después.', aceptar: 'Reemplazar', peligro: true }))) return
    const anterior = exportarDatos(s)
    s.reemplazarTodo(resultado.datos)
    vibrar(20)
    toast('Datos importados', {
      detalle: `${resultado.gastos} gastos y ${resultado.movimientos} movimientos${resultado.duplicados ? `, ${resultado.duplicados} repetidos omitidos` : ''}`,
      accion: { texto: 'Deshacer', onClick: () => useStore.getState().reemplazarTodo(anterior) },
      duracion: 8000,
    })
    cancelar()
  }

  const plantilla = async () => {
    const lib = await import('../lib/excel')
    lib.descargar(await lib.plantillaExcel(exportarDatos(s)), 'plantilla-control-financiero.xlsx')
    toast('Plantilla descargada', { detalle: 'Tiene listas desplegables con tus categorías, cuentas y fondos' })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    const f = e.dataTransfer.files?.[0]
    if (f) analizar(f)
  }

  const nadaNuevo = Boolean(resultado) && resultado!.gastos === 0 && resultado!.movimientos === 0 && resultado!.categoriasNuevas.length === 0 && resultado!.cuentasNuevas.length === 0 && resultado!.fondosNuevos.length === 0

  return (
    <Card
      icon={Upload}
      title="Cargar datos"
      subtitle="Desde un Excel exportado, la plantilla, un CSV o un respaldo"
      action={
        <button className="btn btn-soft !min-h-9 !px-3 text-sm" onClick={plantilla}>
          <FileSpreadsheet size={16} /> Plantilla
        </button>
      }
    >
      <div className="space-y-4">
        <Field label="Qué hacer con lo que ya tienes" grupo>
          <Segmented
            full
            size="sm"
            value={modo}
            onChange={cambiarModo}
            options={[
              { id: 'combinar', label: 'Agregar' },
              { id: 'reemplazar', label: 'Reemplazar todo' },
            ]}
          />
        </Field>
        <p className="text-xs text-muted -mt-2">
          {modo === 'combinar' ? 'Suma los registros del archivo a los tuyos. Los repetidos no se duplican.' : 'Borra tus datos actuales y deja solo los del archivo.'}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          {!archivo ? (
            <motion.div key="zona" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setArrastrando(true)
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={onDrop}
                animate={{ scale: arrastrando ? 1.015 : 1 }}
                className={`w-full rounded-[1.25rem] border-2 border-dashed px-4 py-9 flex flex-col items-center text-center transition-colors ${
                  arrastrando ? 'border-primary bg-primary-soft/70' : 'border-line hover:border-primary/60 hover:bg-surface-2'
                }`}
              >
                <motion.span animate={{ y: arrastrando ? -6 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }} className="h-14 w-14 rounded-2xl bg-primary text-primary-ink grid place-items-center mb-3">
                  <CloudUpload size={28} />
                </motion.span>
                <span className="font-bold">{arrastrando ? 'Suelta el archivo aquí' : 'Arrastra tu archivo o toca para elegirlo'}</span>
                <span className="text-xs text-muted mt-1">Excel (.xlsx, .xlsm, .xls), CSV o respaldo .json</span>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="vista" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5">
                <IconBadge icon={/\.json$/i.test(archivo.name) ? FileJson : /\.csv$/i.test(archivo.name) ? FileText : FileSpreadsheet} color="var(--ok)" size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{archivo.name}</p>
                  <p className="text-xs text-muted">{cargando ? 'Leyendo…' : resultado ? resultado.formato : error ? 'No se pudo leer' : ''}</p>
                </div>
                <button className="btn btn-icon text-muted" onClick={cancelar} aria-label="Quitar archivo">
                  <X size={18} />
                </button>
              </div>

              {cargando && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                  <LoaderCircle size={18} className="animate-spin" /> Analizando el archivo
                </div>
              )}

              {error && (
                <div className="rounded-2xl bg-bad/10 text-bad px-4 py-3 text-sm flex gap-2">
                  <CircleAlert size={18} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {resultado && <VistaPrevia r={resultado} modo={modo} />}

              {resultado && (
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <button className="btn btn-ghost sm:flex-1" onClick={cancelar}>
                    Cancelar
                  </button>
                  <button className={`btn sm:flex-[2] ${modo === 'reemplazar' ? 'bg-bad text-white' : 'btn-primary'}`} onClick={aplicar} disabled={nadaNuevo && modo === 'combinar'}>
                    <Upload size={18} />
                    {modo === 'reemplazar' ? 'Reemplazar con este archivo' : nadaNuevo ? 'No hay registros nuevos' : `Importar ${resultado.gastos + resultado.movimientos} registros`}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <input
          ref={input}
          type="file"
          accept={ACEPTA}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) analizar(f)
            e.target.value = ''
          }}
        />
      </div>
    </Card>
  )
}

function VistaPrevia({ r, modo }: { r: ResultadoImportacion; modo: ModoImport }) {
  const mon = useStore((s) => s.ajustes.moneda)
  const nuevos = [
    ...r.categoriasNuevas.map((n) => ({ n, t: 'Categoría' })),
    ...r.cuentasNuevas.map((n) => ({ n, t: 'Cuenta' })),
    ...r.fondosNuevos.map((n) => ({ n, t: 'Fondo' })),
    ...r.metodosNuevos.map((n) => ({ n, t: 'Método' })),
  ]
  const iconoTipo = { Gasto: ShoppingBag, Ingreso: ArrowDownLeft, Transferencia: ArrowLeftRight }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Cifra k="Gastos nuevos" v={r.gastos} />
        <Cifra k="Ingresos y transf." v={r.movimientos} />
        <Cifra k="Repetidos omitidos" v={r.duplicados} tenue />
      </div>
      {r.desde && (
        <p className="text-xs text-muted inline-flex items-center gap-1.5">
          <CalendarRange size={14} /> Registros del {fechaCorta(r.desde)} {r.desde.slice(0, 4)} al {fechaCorta(r.hasta!)} {r.hasta!.slice(0, 4)}
        </p>
      )}

      {r.muestra.length > 0 && (
        <div className="rounded-2xl border border-line divide-y divide-line overflow-hidden">
          {r.muestra.map((m, i) => {
            const Icono = iconoTipo[m.tipo]
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Icono size={16} className={m.tipo === 'Ingreso' ? 'text-ok' : 'text-muted'} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{m.descripcion || m.detalle || m.tipo}</p>
                  <p className="text-xs text-muted truncate">
                    {fechaCorta(m.fecha)}, {m.detalle}
                  </p>
                </div>
                <span className={`num font-semibold ${m.tipo === 'Gasto' ? 'text-bad' : m.tipo === 'Ingreso' ? 'text-ok' : ''}`}>{money(m.monto, mon)}</span>
              </div>
            )
          })}
          {r.gastos + r.movimientos > r.muestra.length && <p className="px-3 py-2 text-xs text-muted">y {r.gastos + r.movimientos - r.muestra.length} más</p>}
        </div>
      )}

      {nuevos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted mb-1.5 inline-flex items-center gap-1.5">
            <Sparkles size={13} /> {modo === 'reemplazar' ? 'Configuración del archivo' : 'Se crearán'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nuevos.slice(0, 14).map(({ n, t }) => (
              <span key={t + n} className="pill bg-surface-2 text-ink !font-medium">
                <span className="text-muted">{t}</span> {n}
              </span>
            ))}
            {nuevos.length > 14 && <span className="pill bg-surface-2 text-muted">+{nuevos.length - 14}</span>}
          </div>
        </div>
      )}

      {r.configActualizada.length > 0 && <p className="text-xs text-muted">También se actualiza: {[...new Set(r.configActualizada)].join(', ')}.</p>}

      {r.avisos.map((a) => (
        <p key={a} className="rounded-xl bg-warn/12 text-warn px-3 py-2 text-xs font-medium flex gap-2">
          <TriangleAlert size={15} className="shrink-0" /> {a}
        </p>
      ))}
    </div>
  )
}

function Cifra({ k, v, tenue = false }: { k: string; v: number; tenue?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
      <p className={`num text-xl font-extrabold ${tenue ? 'text-muted' : ''}`}>{v}</p>
      <p className="text-[11px] text-muted leading-tight">{k}</p>
    </div>
  )
}

/* ───────────────────────── Respaldo ───────────────────────── */

function Respaldo() {
  const s = useStore()
  const total = s.gastos.length + s.movimientos.length
  const respaldo = async () => {
    const { descargar } = await import('../lib/excel')
    descargar(new Blob([JSON.stringify(exportarDatos(s), null, 2)], { type: 'application/json' }), `respaldo-control-financiero-${hoyISO()}.json`)
    toast('Respaldo descargado', { detalle: 'Para restaurarlo, arrástralo en Cargar datos' })
  }
  const restablecer = async () => {
    if (!(await confirmar('¿Borrar todo y empezar de cero?', { texto: 'Se borran todos los gastos, movimientos y la configuración. Te recomendamos descargar un respaldo antes.', aceptar: 'Borrar todo', peligro: true }))) return
    const anterior = exportarDatos(s)
    s.restablecer()
    toast('Datos borrados', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().reemplazarTodo(anterior) }, duracion: 8000 })
  }
  return (
    <Card icon={Database} title="Respaldo y dispositivos" subtitle="Tus datos viven solo en este dispositivo. Usa un respaldo para pasarlos al celular o a otra computadora.">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-muted flex-1">
          Tienes <b className="text-ink num">{total}</b> registros, {s.categorias.length} categorías, {s.cuentas.length} cuentas y {s.fondos.length} fondos.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button className="btn btn-ghost" onClick={respaldo}>
            <FileJson size={17} /> Descargar respaldo
          </button>
          <button className="btn btn-danger" onClick={restablecer}>
            <RotateCcw size={17} /> Borrar todo
          </button>
        </div>
      </div>
    </Card>
  )
}
