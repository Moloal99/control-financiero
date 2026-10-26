import { ArrowLeftRight, ArrowDownToLine, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { fechaLarga, mesDe, money } from '../lib/format'
import type { Gasto, Movimiento } from '../types'
import { Card, Empty } from '../components/ui'

type Filtro = 'todos' | 'gastos' | 'ingresos' | 'transferencias'

type Item =
  | { kind: 'gasto'; fecha: string; id: string; g: Gasto }
  | { kind: 'mov'; fecha: string; id: string; m: Movimiento }

export function Movimientos({ mes, onEditarGasto, onEditarMovimiento }: { mes: string; onEditarGasto: (g: Gasto) => void; onEditarMovimiento: (m: Movimiento) => void }) {
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

  const totalGastos = items.filter((i) => i.kind === 'gasto').reduce((a, i) => a + (i.kind === 'gasto' ? i.g.monto : 0), 0)
  const totalIngresos = items.filter((i) => i.kind === 'mov' && i.m.tipo === 'ingreso').reduce((a, i) => a + (i.kind === 'mov' ? i.m.monto : 0), 0)

  const nombre = (arr: { id: string; nombre: string }[], id: string | null) => arr.find((x) => x.id === id)?.nombre ?? '—'

  const eliminar = (it: Item) => {
    if (!confirm('¿Eliminar este registro?')) return
    if (it.kind === 'gasto') s.eliminarGasto(it.id)
    else s.eliminarMovimiento(it.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="flex gap-1 p-1 rounded-xl bg-surface-2 overflow-x-auto">
          {(['todos', 'gastos', 'ingresos', 'transferencias'] as Filtro[]).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${filtro === f ? 'bg-surface shadow text-primary' : 'text-muted'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder="Buscar descripción…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input md:w-56" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {s.categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          {items.length} registros · Gastos <b className="text-ink num">{money(totalGastos, mon)}</b>
        </span>
        {totalIngresos > 0 && (
          <span>
            Ingresos <b className="text-ink num">{money(totalIngresos, mon)}</b>
          </span>
        )}
      </div>

      {grupos.length === 0 ? (
        <Card>
          <Empty>No hay registros con estos filtros en este mes.</Empty>
        </Card>
      ) : (
        grupos.map(([fecha, lista]) => (
          <Card key={fecha} padding={false}>
            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted uppercase tracking-wide">{fechaLarga(fecha)}</p>
            <ul className="divide-y divide-line">
              {lista.map((it) => {
                if (it.kind === 'gasto') {
                  const c = s.categorias.find((x) => x.id === it.g.categoriaId)
                  return (
                    <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="h-9 w-9 rounded-xl grid place-items-center text-white dark:text-[#03201c] font-bold text-xs shrink-0" style={{ background: c?.color ?? 'var(--muted)' }}>
                        {(c?.nombre ?? '?').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{it.g.descripcion || c?.nombre || 'Gasto'}</p>
                        <p className="text-xs text-muted truncate">
                          {c?.nombre ?? 'Sin categoría'} · {nombre(s.cuentas, it.g.cuentaId)} · {nombre(s.fondos, it.g.fondoId)} · {nombre(s.metodos, it.g.metodoId)}
                        </p>
                      </div>
                      <span className="num font-semibold text-bad">-{money(it.g.monto, mon)}</span>
                      <Acciones onEditar={() => onEditarGasto(it.g)} onEliminar={() => eliminar(it)} />
                    </li>
                  )
                }
                const ing = it.m.tipo === 'ingreso'
                return (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${ing ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-muted'}`}>
                      {ing ? <ArrowDownToLine size={18} /> : <ArrowLeftRight size={18} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{it.m.descripcion || (ing ? 'Ingreso' : 'Transferencia')}</p>
                      <p className="text-xs text-muted truncate">
                        {ing ? `Ingreso → ${nombre(s.cuentas, it.m.cuentaDestinoId)}` : `${nombre(s.cuentas, it.m.cuentaOrigenId)} → ${nombre(s.cuentas, it.m.cuentaDestinoId)}`}
                      </p>
                    </div>
                    <span className={`num font-semibold ${ing ? 'text-ok' : ''}`}>
                      {ing ? '+' : ''}
                      {money(it.m.monto, mon)}
                    </span>
                    <Acciones onEditar={() => onEditarMovimiento(it.m)} onEliminar={() => eliminar(it)} />
                  </li>
                )
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}

function Acciones({ onEditar, onEliminar }: { onEditar: () => void; onEliminar: () => void }) {
  return (
    <div className="flex gap-1 shrink-0">
      <button className="btn btn-ghost !border-0 !min-h-8 !px-2 text-muted" onClick={onEditar} aria-label="Editar">
        <Pencil size={16} />
      </button>
      <button className="btn btn-ghost !border-0 !min-h-8 !px-2 text-muted hover:text-bad" onClick={onEliminar} aria-label="Eliminar">
        <Trash2 size={16} />
      </button>
    </div>
  )
}
