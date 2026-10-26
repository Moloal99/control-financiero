import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { FileSpreadsheet } from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Layout, VISTAS, type Vista } from './components/Layout'
import { Registrar } from './components/Registrar'
import { ConfirmDialog, MonthPicker, Segmented, Toaster } from './components/ui'
import { mesActual } from './lib/format'
import { Movimientos } from './pages/Movimientos'
import { Panel } from './pages/Panel'
import { useStore } from './store'
import type { Gasto, Movimiento } from './types'

const Cuentas = lazy(() => import('./pages/Cuentas').then((m) => ({ default: m.Cuentas })))
const Analisis = lazy(() => import('./pages/Analisis').then((m) => ({ default: m.Analisis })))
const Proyeccion = lazy(() => import('./pages/Proyeccion').then((m) => ({ default: m.Proyeccion })))
const Datos = lazy(() => import('./pages/Datos').then((m) => ({ default: m.Datos })))
const Ajustes = lazy(() => import('./pages/Ajustes').then((m) => ({ default: m.Ajustes })))

function vistaDesdeHash(): Vista {
  const h = window.location.hash.replace('#', '') as Vista
  return VISTAS.some((v) => v.id === h) ? h : 'panel'
}

function useTema(): boolean {
  const tema = useStore((s) => s.ajustes.tema)
  const [sistemaOscuro, setSistemaOscuro] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const f = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  const oscuro = tema === 'oscuro' || (tema === 'sistema' && sistemaOscuro)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro)
    document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0d0f1c' : '#eef0f3')
  }, [oscuro])
  return oscuro
}

export default function App() {
  const [vista, setVista] = useState<Vista>(vistaDesdeHash)
  const [mes, setMes] = useState(mesActual)
  const [registrar, setRegistrar] = useState(false)
  const [editGasto, setEditGasto] = useState<Gasto | null>(null)
  const [editMov, setEditMov] = useState<Movimiento | null>(null)
  const oscuro = useTema()

  useEffect(() => {
    const f = () => setVista(vistaDesdeHash())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  // Atajo de teclado: "N" abre el registro rápido.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea|select/i.test(t.tagName)) {
        e.preventDefault()
        setRegistrar(true)
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  const irA = useCallback((v: Vista) => {
    if (window.location.hash !== `#${v}`) window.location.hash = v
    setVista(v)
    window.scrollTo({ top: 0 })
  }, [])

  const cerrar = useCallback(() => {
    setRegistrar(false)
    setEditGasto(null)
    setEditMov(null)
  }, [])

  const actual = VISTAS.find((v) => v.id === vista)!
  const conMes = vista !== 'ajustes' && vista !== 'datos'

  return (
    <MotionConfig reducedMotion="user">
      <Layout vista={vista} onVista={irA} onRegistrar={() => setRegistrar(true)} oscuro={oscuro}>
        {/* Encabezado de la vista */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-6">
          <div className="hidden md:block">
            <h1 className="text-[28px] font-extrabold tracking-tight leading-tight">{actual.nombre}</h1>
            <p className="text-sm text-muted">{actual.descripcion}</p>
          </div>
          {conMes && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <MonthPicker mes={mes} onChange={setMes} />
              <button className="btn btn-ghost hidden md:inline-flex !min-h-10" onClick={() => irA('datos')}>
                <FileSpreadsheet size={17} /> Excel
              </button>
            </div>
          )}
        </div>

        {(vista === 'analisis' || vista === 'proyeccion') && (
          <div className="md:hidden mb-4">
            <Segmented
              full
              options={[
                { id: 'analisis' as const, label: 'Tendencias' },
                { id: 'proyeccion' as const, label: 'Proyección' },
              ]}
              value={vista}
              onChange={irA}
            />
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={vista}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<div className="h-64 rounded-[1.25rem] bg-surface-2 animate-pulse" />}>
              {vista === 'panel' && <Panel mes={mes} oscuro={oscuro} onIrA={irA} onRegistrar={() => setRegistrar(true)} />}
              {vista === 'movimientos' && <Movimientos mes={mes} onEditarGasto={setEditGasto} onEditarMovimiento={setEditMov} onRegistrar={() => setRegistrar(true)} />}
              {vista === 'cuentas' && <Cuentas mes={mes} />}
              {vista === 'analisis' && <Analisis mes={mes} oscuro={oscuro} />}
              {vista === 'proyeccion' && <Proyeccion mes={mes} />}
              {vista === 'datos' && <Datos mes={mes} />}
              {vista === 'ajustes' && <Ajustes onIrA={irA} />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </Layout>

      <Registrar open={registrar || Boolean(editGasto) || Boolean(editMov)} onClose={cerrar} gasto={editGasto} movimiento={editMov} />
      <ConfirmDialog />
      <Toaster />
    </MotionConfig>
  )
}
