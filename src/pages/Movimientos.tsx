import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownLeft, ArrowLeftRight, Download, Inbox, Layers, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { confirmar, toast } from '../lib/feedback'
import { fechaLarga, mesDe, money, nombreMes } from '../lib/format'
import { iconoDe } from '../lib/iconos'
import type { Gasto, Movimiento } from '../types'
import { Card, Empty, IconBadge, Segmented } from '../components/ui'

type Filtro = 'todos' | 'gastos' | 'ingresos' | 'transferencias'

type Item =
  | { kind: 'gasto'; fecha: string; id: string; g: Gasto }
  | { kind: 'mov'; fecha: string; id: string; m: Movimiento }

export function Movimientos({
  mes,
  onEditarGasto,
  onEditarMovimiento,
  onRegistrar,
}: {
  mes: string
  onEditarGasto: (g: Gasto) => void
  onEditarMovimiento: (m: Movimiento) => void
  onRegistrar: () => void
}) {
  const s = useStore()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const mon = s.ajustes.moneda

  const items = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const out: Item[] = []
    if (filtro === 'todos' || filtro === 'gastos') {
      for (const g of s.gastos) {
        if (mesDe(g.fecha) !== mes) continue
        if (cat && g.categoriaId !== cat) continue
        if (ql && !g.descripcion.toLowerCase().includes(ql) && !s.categorias.find((c) => c.id === g.categoriaId)?.nombre.toLowerCase().includes(ql)) continue
        out.push({ kind: 'gasto', fecha: g.fecha, id: g.id, g })
      }
    }
    if (filtro === 'todos' || filtro === 'ingresos' || filtro === 'transferencias') {
      for (const m of s.movimientos) {
        if (mesDe(m.fecha) !== mes) continue
        if (cat) continue
        if (filtro === 'ingresos' && m.tipo !== 'ingreso') continue
        if (filtro === 'transferencias' && m.tipo !== 'transferencia') continue
        if (ql && !m.descripcion.toLowerCase().includes(ql)) continue
        out.push({ kind: 'mov', fecha: m.fecha, id: m.id, m })
      }
    }
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [s, mes, filtro, q, cat])

  const grupos = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of items) map.set(it.fecha, [...(map.get(it.fecha) ?? []), it])
    return [...map.entries()]
  }, [items])

  const totalGastos = items.reduce((a, i) => a + (i.kind === 'gasto' ? i.g.monto : 0), 0)
  const totalIngresos = items.reduce((a, i) => a + (i.kind === 'mov' && i.m.tipo === 'ingreso' ? i.m.monto : 0), 0)
  const nombre = (arr: { id: string; nombre: string }[], id: string | null) => arr.find((x) => x.id === id)?.nombre ?? '—'
  const hayFiltros = filtro !== 'todos' || q !== '' || cat !== ''

  const eliminar = async (it: Item) => {
    if (!(await confirmar('¿Eliminar este registro?', { aceptar: 'Eliminar', peligro: true }))) return
    if (it.kind === 'gasto') {
      s.eliminarGasto(it.id)
      toast('Gasto eliminado', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().agregarGasto(it.g) }, duracion: 5000 })
    } else {
      s.eliminarMovimiento(it.id)
      toast('Registro eliminado', { tono: 'info', accion: { texto: 'Deshacer', onClick: () => useStore.getState().agregarMovimiento(it.m) }, duracion: 5000 })
    }
  }

  const exportar = async () => {
    const { exportarExcel, descargar } = await import('../lib/excel')
    const ids = new Set(items.map((i) => i.id))
    const datos = { ...s, gastos: s.gastos.filter((g) => ids.has(g.id)), movimientos: s.movimientos.filter((m) => ids.has(m.id)) }
    const blob = await exportarExcel(datos, { titulo: `Movimientos de ${nombreMes(mes)}`, soloMovimientos: true })
    descargar(blob, `movimientos-${mes}.xlsx`)
    toast('Excel descargado', { detalle: `${items.length} registros de ${nombreMes(mes)}` })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <Segmented
            value={filtro}
            onChange={setFiltro}
            size="sm"
            full
            className="md:!w-fit"
            options={[
              { id: 'todos', label: 'Todo', icon: Layers },
              { id: 'gastos', label: 'Gastos', icon: ShoppingBag },
              { id: 'ingresos', label: 'Ingresos', icon: ArrowDownLeft },
              {
                id: 'transferencias',
                label: (
                  <>
                    <span className="sm:hidden">Transf.</span>
                    <span className="hidden sm:inline">Transferencias</span>
                  </>
                ),
                icon: ArrowLeftRight,
              },
            ]}
          />
          <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input className="input !pl-10 !pr-10" placeholder="Buscar por descripción o categoría" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-icon !min-h-8 !min-w-8 text-muted" onClick={() => setQ('')} aria-label="Limpiar búsqueda">
                <X size={16} />
              </button>
            )}
          </div>
          <button className="btn btn-ghost !px-3 sm:!px-4" onClick={exportar} disabled={items.length === 0} aria-label="Exportar a Excel" title="Exportar a Excel">
            <Download size={17} /> <span className="hidden sm:inline">Exportar</span>
          </button>
          </div>
        </div>

        {(filtro === 'todos' || filtro === 'gastos') && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
            <ChipCat activo={cat === ''} onClick={() => setCat('')}>
              Todas
            </ChipCat>
            {s.categorias.map((c) => {
              const Icono = iconoDe(c)
              return (
                <ChipCat key={c.id} activo={cat === c.id} onClick={() => setCat(cat === c.id ? '' : c.id)} color={c.color}>
                  <Icono size={15} style={{ color: cat === c.id ? undefined : c.color }} /> {c.nombre}
                </ChipCat>
              )
            })}
          </div>
        )}
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Resumen k="Gastos" v={money(totalGastos, mon)} cls="text-bad" />
        <Resumen k="Ingresos" v={money(totalIngresos, mon)} cls="text-ok" />
        <Resumen k="Registros" v={String(items.length)} />
      </div>

      {grupos.length === 0 ? (
        <Card>
          {hayFiltros ? (
            <Empty
              icon={Search}
              title="Nada coincide con estos filtros"
              action={
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setFiltro('todos')
                    setQ('')
                    setCat('')
                  }}
                >
                  Quitar filtros
                </button>
              }
            >
              Prueba con otra búsqueda o categoría.
            </Empty>
          ) : (
            <Empty
              icon={Inbox}
              title={`Sin registros en ${nombreMes(mes)}`}
              action={
                <button className="btn btn-primary" onClick={onRegistrar}>
                  <Plus size={18} /> Registrar
                </button>
              }
            >
              Registra un gasto, un ingreso o una transferencia, o importa tus datos desde Excel.
            </Empty>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {grupos.map(([fecha, lista]) => {
            const totalDia = lista.reduce((a, i) => a + (i.kind === 'gasto' ? i.g.monto : 0), 0)
            return (
              <Card key={fecha} padding={false} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
                  <p className="text-[13px] font-bold text-muted">{fechaLarga(fecha)}</p>
                  {totalDia > 0 && <p className="num text-[13px] font-semibold text-muted">-{money(totalDia, mon)}</p>}
                </div>
                <ul>
                  <AnimatePresence initial={false}>
                    {lista.map((it) => (
                      <motion.li
                        key={it.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0, x: -40 }}
                        transition={{ duration: 0.22 }}
                        className="border-t border-line first:border-t-0"
                      >
                        {it.kind === 'gasto' ? (
                          <FilaGasto it={it} onEditar={() => onEditarGasto(it.g)} onEliminar={() => eliminar(it)} nombre={nombre} />
                        ) : (
                          <FilaMov it={it} onEditar={() => onEditarMovimiento(it.m)} onEliminar={() => eliminar(it)} nombre={nombre} />
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Nombre = (a: { id: string; nombre: string }[], id: string | null) => string

function FilaGasto({ it, onEditar, onEliminar, nombre }: { it: Extract<Item, { kind: 'gasto' }>; onEditar: () => void; onEliminar: () => void; nombre: Nombre }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const c = s.categorias.find((x) => x.id === it.g.categoriaId)
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-2/70 transition-colors">
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onEditar} aria-label="Editar gasto">
        <IconBadge icon={c ? iconoDe(c) : ShoppingBag} color={c?.color ?? 'var(--muted)'} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{it.g.descripcion || c?.nombre || 'Gasto'}</p>
          <p className="text-xs text-muted truncate">
            {c?.nombre ?? 'Sin categoría'}, {nombre(s.fondos, it.g.fondoId)}, {nombre(s.cuentas, it.g.cuentaId)}
            <span className="hidden sm:inline">, {nombre(s.metodos, it.g.metodoId)}</span>
          </p>
        </div>
        <span className="num font-bold text-bad shrink-0">-{money(it.g.monto, mon)}</span>
      </button>
      <BotonEliminar onClick={onEliminar} />
    </div>
  )
}

function FilaMov({ it, onEditar, onEliminar, nombre }: { it: Extract<Item, { kind: 'mov' }>; onEditar: () => void; onEliminar: () => void; nombre: Nombre }) {
  const s = useStore()
  const mon = s.ajustes.moneda
  const ing = it.m.tipo === 'ingreso'
  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-2/70 transition-colors">
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onEditar} aria-label="Editar registro">
        <IconBadge icon={ing ? ArrowDownLeft : ArrowLeftRight} color={ing ? 'var(--ok)' : 'var(--muted)'} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{it.m.descripcion || (ing ? 'Ingreso' : 'Transferencia')}</p>
          <p className="text-xs text-muted truncate">{ing ? `Ingreso a ${nombre(s.cuentas, it.m.cuentaDestinoId)}` : `${nombre(s.cuentas, it.m.cuentaOrigenId)} a ${nombre(s.cuentas, it.m.cuentaDestinoId)}`}</p>
        </div>
        <span className={`num font-bold shrink-0 ${ing ? 'text-ok' : ''}`}>
          {ing ? '+' : ''}
          {money(it.m.monto, mon)}
        </span>
      </button>
      <BotonEliminar onClick={onEliminar} />
    </div>
  )
}

function BotonEliminar({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn-icon text-muted hover:!text-bad hidden md:inline-flex md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0" onClick={onClick} aria-label="Eliminar">
      <Trash2 size={17} />
    </button>
  )
}

function ChipCat({ activo, onClick, color, children }: { activo: boolean; onClick: () => void; color?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold border transition-colors ${
        activo ? 'text-white border-transparent' : 'bg-surface border-line hover:bg-surface-2'
      }`}
      style={activo ? { background: color ?? 'var(--primary)' } : undefined}
    >
      {children}
    </button>
  )
}

function Resumen({ k, v, cls = '' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="card px-3 py-2.5 md:px-4 md:py-3 min-w-0">
      <p className="text-xs text-muted">{k}</p>
      <p className={`num font-extrabold text-[15px] md:text-lg truncate ${cls}`}>{v}</p>
    </div>
  )
}
