import { BarChart3, LayoutDashboard, List, Moon, Plus, Settings, Sun, TrendingUp, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../store'

export type Vista = 'panel' | 'movimientos' | 'cuentas' | 'analisis' | 'proyeccion' | 'ajustes'

export const VISTAS: { id: Vista; nombre: string; icono: typeof LayoutDashboard }[] = [
  { id: 'panel', nombre: 'Panel', icono: LayoutDashboard },
  { id: 'movimientos', nombre: 'Movimientos', icono: List },
  { id: 'cuentas', nombre: 'Cuentas y fondos', icono: Wallet },
  { id: 'analisis', nombre: 'Análisis', icono: BarChart3 },
  { id: 'proyeccion', nombre: 'Proyección', icono: TrendingUp },
  { id: 'ajustes', nombre: 'Ajustes', icono: Settings },
]

export function Layout({
  vista,
  onVista,
  onRegistrar,
  oscuro,
  children,
}: {
  vista: Vista
  onVista: (v: Vista) => void
  onRegistrar: () => void
  oscuro: boolean
  children: ReactNode
}) {
  const setAjustes = useStore((s) => s.setAjustes)
  const toggleTema = () => setAjustes({ tema: oscuro ? 'claro' : 'oscuro' })
  const movil: Vista[] = ['panel', 'movimientos', 'analisis', 'cuentas']

  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-line bg-surface sticky top-0 h-dvh">
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-white dark:text-[#03201c] grid place-items-center font-black">Bs</div>
          <div>
            <p className="font-bold leading-tight">Control Financiero</p>
            <p className="text-xs text-muted">Finanzas personales</p>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-1">
          {VISTAS.map((v) => {
            const Icono = v.icono
            const activo = v.id === vista
            return (
              <button
                key={v.id}
                onClick={() => onVista(v.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  activo ? 'bg-primary-soft text-primary' : 'hover:bg-surface-2 text-ink'
                }`}
              >
                <Icono size={18} />
                {v.nombre}
              </button>
            )
          })}
        </nav>
        <div className="p-3 space-y-2">
          <button className="btn btn-primary w-full" onClick={onRegistrar}>
            <Plus size={18} /> Registrar
          </button>
          <button className="btn btn-ghost w-full" onClick={toggleTema}>
            {oscuro ? <Sun size={16} /> : <Moon size={16} />} {oscuro ? 'Tema claro' : 'Tema oscuro'}
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <header className="md:hidden sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-white dark:text-[#03201c] grid place-items-center font-black text-sm">Bs</div>
            <p className="font-bold">Control Financiero</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost !border-0 !min-h-9 !px-2" onClick={toggleTema} aria-label="Cambiar tema">
              {oscuro ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn btn-ghost !border-0 !min-h-9 !px-2" onClick={() => onVista('ajustes')} aria-label="Ajustes">
              <Settings size={18} />
            </button>
          </div>
        </header>
        <main className="px-4 py-4 md:px-8 md:py-6 max-w-7xl mx-auto pb-28 md:pb-10">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line safe-bottom">
        <div className="grid grid-cols-5 items-end">
          {movil.slice(0, 2).map((id) => (
            <NavBtn key={id} id={id} vista={vista} onVista={onVista} />
          ))}
          <div className="flex justify-center -mt-5">
            <button
              onClick={onRegistrar}
              className="h-14 w-14 rounded-full bg-primary text-white dark:text-[#03201c] shadow-lg grid place-items-center active:scale-95 transition"
              aria-label="Registrar"
            >
              <Plus size={26} />
            </button>
          </div>
          {movil.slice(2).map((id) => (
            <NavBtn key={id} id={id} vista={vista} onVista={onVista} />
          ))}
        </div>
      </nav>
    </div>
  )
}

function NavBtn({ id, vista, onVista }: { id: Vista; vista: Vista; onVista: (v: Vista) => void }) {
  const v = VISTAS.find((x) => x.id === id)!
  const Icono = v.icono
  const activo = vista === id || (id === 'cuentas' && vista === 'proyeccion')
  return (
    <button onClick={() => onVista(id)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${activo ? 'text-primary' : 'text-muted'}`}>
      <Icono size={20} />
      {id === 'cuentas' ? 'Cuentas' : v.nombre}
    </button>
  )
}
