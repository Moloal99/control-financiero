import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeftRight, Bell, CalendarRange, ChartColumn, Ellipsis, FileSpreadsheet, House, Landmark, Moon, Plus, Settings, Sun, Target,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { vibrar } from '../lib/feedback'
import { Modal } from './ui'

export type Vista = 'inicio' | 'movimientos' | 'metas' | 'cuentas' | 'plan' | 'analisis' | 'datos' | 'ajustes'

export const VISTAS: { id: Vista; nombre: string; corto: string; icono: LucideIcon; descripcion: string; secundaria?: boolean }[] = [
  { id: 'inicio', nombre: 'Inicio', corto: 'Inicio', icono: House, descripcion: 'Cuánto puedes gastar y cómo van tus metas' },
  { id: 'movimientos', nombre: 'Movimientos', corto: 'Movimientos', icono: ArrowLeftRight, descripcion: 'Gastos, ingresos y dinero apartado' },
  { id: 'metas', nombre: 'Metas de ahorro', corto: 'Metas', icono: Target, descripcion: 'A dónde quieres llegar y cuánto te falta' },
  { id: 'cuentas', nombre: 'Cuentas y fondos', corto: 'Cuentas', icono: Landmark, descripcion: 'Dónde está tu dinero y para qué es' },
  { id: 'plan', nombre: 'Plan', corto: 'Plan', icono: CalendarRange, descripcion: 'Presupuesto, gastos fijos y proyección' },
  { id: 'analisis', nombre: 'Análisis', corto: 'Análisis', icono: ChartColumn, descripcion: 'Tendencias, patrimonio y cierre de mes' },
  { id: 'datos', nombre: 'Importar y exportar', corto: 'Datos', icono: FileSpreadsheet, descripcion: 'Excel, plantillas y respaldos', secundaria: true },
  { id: 'ajustes', nombre: 'Ajustes', corto: 'Ajustes', icono: Settings, descripcion: 'Categorías, cuentas, fondos y preferencias', secundaria: true },
]

/** Vistas que en el celular viven dentro de "Más". */
const EN_MAS: Vista[] = ['cuentas', 'plan', 'analisis', 'datos', 'ajustes']

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <rect width="48" height="48" rx="13" fill="#3d35b5" />
      <rect x="11" y="27" width="7" height="10" rx="2.5" fill="#fff" opacity=".55" />
      <rect x="20.5" y="20" width="7" height="17" rx="2.5" fill="#fff" opacity=".8" />
      <rect x="30" y="11" width="7" height="26" rx="2.5" fill="#f2a900" />
    </svg>
  )
}

export function Layout({
  vista,
  onVista,
  onRegistrar,
  onAlertas,
  nAlertas,
  oscuro,
  children,
}: {
  vista: Vista
  onVista: (v: Vista) => void
  onRegistrar: () => void
  onAlertas: () => void
  nAlertas: number
  oscuro: boolean
  children: ReactNode
}) {
  const setAjustes = useStore((s) => s.setAjustes)
  const toggleTema = () => setAjustes({ tema: oscuro ? 'claro' : 'oscuro' })
  const [mas, setMas] = useState(false)
  const actual = VISTAS.find((v) => v.id === vista)!
  const principales = VISTAS.filter((v) => !v.secundaria)
  const secundarias = VISTAS.filter((v) => v.secundaria)

  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral (escritorio y tableta) */}
      <aside className="hidden md:flex md:flex-col w-[76px] lg:w-[248px] shrink-0 bg-rail text-rail-ink sticky top-0 h-dvh">
        <div className="px-4 lg:px-5 pt-5 pb-6 flex items-center gap-3 justify-center lg:justify-start">
          <Logo />
          <div className="hidden lg:block">
            <p className="font-extrabold text-white leading-tight tracking-tight">Control Financiero</p>
            <p className="text-xs opacity-70">Tus finanzas en Bs</p>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-1 overflow-y-auto no-scrollbar" aria-label="Secciones">
          {principales.map((v) => (
            <RailItem key={v.id} v={v} activo={v.id === vista} onClick={() => onVista(v.id)} />
          ))}
          <div className="h-px bg-white/10 my-3 mx-2" />
          {secundarias.map((v) => (
            <RailItem key={v.id} v={v} activo={v.id === vista} onClick={() => onVista(v.id)} />
          ))}
        </nav>
        <div className="p-3 space-y-2">
          <button
            className="btn w-full bg-accent text-[#1d1a4d] hover:brightness-105 !px-0 lg:!px-4"
            onClick={() => {
              vibrar()
              onRegistrar()
            }}
            title="Registrar (N)"
          >
            <Plus size={20} strokeWidth={2.6} /> <span className="hidden lg:inline">Registrar</span>
          </button>
          <div className="flex flex-col lg:flex-row gap-1">
            <button className="btn flex-1 !px-0 text-rail-ink hover:bg-white/8 relative" onClick={onAlertas} title="Avisos">
              <Bell size={18} />
              <span className="hidden lg:inline">Avisos</span>
              {nAlertas > 0 && <Contador n={nAlertas} />}
            </button>
            <button className="btn flex-1 !px-0 text-rail-ink hover:bg-white/8" onClick={toggleTema} title={oscuro ? 'Tema claro' : 'Tema oscuro'}>
              {oscuro ? <Sun size={18} /> : <Moon size={18} />}
              <span className="hidden lg:inline">{oscuro ? 'Claro' : 'Oscuro'}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Cabecera móvil */}
        <header className="md:hidden sticky top-0 z-30 bg-bg/85 backdrop-blur-xl safe-top">
          <div className="px-4 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Logo size={30} />
              <p className="font-extrabold text-[17px] tracking-tight truncate">{actual.nombre}</p>
            </div>
            <div className="flex items-center">
              <button className="btn btn-icon text-muted relative" onClick={onAlertas} aria-label={`Avisos${nAlertas ? ` (${nAlertas})` : ''}`}>
                <Bell size={20} />
                {nAlertas > 0 && <Contador n={nAlertas} />}
              </button>
              <button className="btn btn-icon text-muted" onClick={toggleTema} aria-label="Cambiar tema">
                {oscuro ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full px-4 pt-2 pb-32 md:px-8 md:pt-7 md:pb-12 max-w-[1240px] mx-auto">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/92 backdrop-blur-xl border-t border-line safe-bottom" aria-label="Secciones">
        <div className="grid grid-cols-5 items-stretch h-16">
          <TabItem id="inicio" activo={vista === 'inicio'} onClick={() => onVista('inicio')} />
          <TabItem id="movimientos" activo={vista === 'movimientos'} onClick={() => onVista('movimientos')} />
          <div className="grid place-items-center">
            <motion.button
              whileTap={{ scale: 0.9, rotate: 90 }}
              onClick={() => {
                vibrar()
                onRegistrar()
              }}
              className="-mt-7 h-[3.6rem] w-[3.6rem] rounded-[1.25rem] bg-primary text-primary-ink grid place-items-center shadow-[0_10px_24px_-8px_color-mix(in_srgb,var(--primary)_70%,transparent)] ring-4 ring-bg"
              aria-label="Registrar gasto, ingreso o movimiento"
            >
              <Plus size={28} strokeWidth={2.6} />
            </motion.button>
          </div>
          <TabItem id="metas" activo={vista === 'metas'} onClick={() => onVista('metas')} />
          <TabItem id="mas" activo={EN_MAS.includes(vista)} onClick={() => setMas(true)} />
        </div>
      </nav>

      <Modal open={mas} onClose={() => setMas(false)} title="Más">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {VISTAS.filter((v) => EN_MAS.includes(v.id)).map((v) => {
            const Icono = v.icono
            const activo = v.id === vista
            return (
              <button
                key={v.id}
                onClick={() => {
                  setMas(false)
                  onVista(v.id)
                }}
                className={`text-left rounded-2xl p-3.5 border transition-colors ${activo ? 'border-primary bg-primary-soft/60' : 'border-line hover:bg-surface-2'}`}
              >
                <Icono size={22} className={activo ? 'text-primary' : 'text-muted'} />
                <p className="font-bold text-sm mt-2">{v.nombre}</p>
                <p className="text-xs text-muted leading-snug mt-0.5">{v.descripcion}</p>
              </button>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

function Contador({ n }: { n: number }) {
  return (
    <AnimatePresence>
      <motion.span
        key={n}
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        className="absolute top-1 right-1 lg:static min-w-[18px] h-[18px] px-1 rounded-full bg-bad text-white text-[10px] font-bold grid place-items-center leading-none"
      >
        {n > 9 ? '9+' : n}
      </motion.span>
    </AnimatePresence>
  )
}

function RailItem({ v, activo, onClick }: { v: (typeof VISTAS)[number]; activo: boolean; onClick: () => void }) {
  const Icono = v.icono
  return (
    <button
      onClick={onClick}
      title={v.nombre}
      aria-current={activo ? 'page' : undefined}
      className={`relative w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
        activo ? 'text-white' : 'text-rail-ink/80 hover:text-white hover:bg-white/6'
      }`}
    >
      {activo && (
        <motion.span layoutId="rail-activo" className="absolute inset-0 rounded-xl bg-white/12" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-accent" />
        </motion.span>
      )}
      <Icono size={19} strokeWidth={activo ? 2.4 : 2} className="relative" />
      <span className="relative hidden lg:inline">{v.nombre}</span>
    </button>
  )
}

function TabItem({ id, activo, onClick }: { id: Vista | 'mas'; activo: boolean; onClick: () => void }) {
  const v = id === 'mas' ? { corto: 'Más', icono: Ellipsis } : VISTAS.find((x) => x.id === id)!
  const Icono = v.icono
  return (
    <button
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${activo ? 'text-primary' : 'text-muted'}`}
    >
      {activo && <motion.span layoutId="tab-activo" className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <motion.span animate={{ y: activo ? -1 : 0, scale: activo ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
        <Icono size={22} strokeWidth={activo ? 2.4 : 2} />
      </motion.span>
      {v.corto}
    </button>
  )
}
