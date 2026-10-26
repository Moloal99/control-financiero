import { useCallback, useEffect, useState } from 'react'
import { Layout, VISTAS, type Vista } from './components/Layout'
import { Registrar } from './components/Registrar'
import { MonthPicker } from './components/ui'
import { mesActual } from './lib/format'
import { Ajustes } from './pages/Ajustes'
import { Analisis } from './pages/Analisis'
import { Cuentas } from './pages/Cuentas'
import { Movimientos } from './pages/Movimientos'
import { Panel } from './pages/Panel'
import { Proyeccion } from './pages/Proyeccion'
import { useStore } from './store'
import type { Gasto, Movimiento } from './types'

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#111a2b' : '#0f766e')
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

  const irA = useCallback((v: Vista) => {
    window.location.hash = v
    setVista(v)
    window.scrollTo({ top: 0 })
  }, [])

  const cerrar = useCallback(() => {
    setRegistrar(false)
    setEditGasto(null)
    setEditMov(null)
  }, [])

  const titulo = VISTAS.find((v) => v.id === vista)?.nombre ?? ''
  const conMes = vista !== 'ajustes'

  return (
    <Layout vista={vista} onVista={irA} onRegistrar={() => setRegistrar(true)} oscuro={oscuro}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl md:text-2xl font-bold">{titulo}</h1>
        {conMes && <MonthPicker mes={mes} onChange={setMes} />}
      </div>

      {(vista === 'analisis' || vista === 'proyeccion') && (
        <div className="md:hidden flex gap-1 p-1 rounded-xl bg-surface-2 mb-4">
          {(['analisis', 'proyeccion'] as const).map((v) => (
            <button key={v} onClick={() => irA(v)} className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${vista === v ? 'bg-surface shadow text-primary' : 'text-muted'}`}>
              {v === 'analisis' ? 'Tendencias' : 'Proyección'}
            </button>
          ))}
        </div>
      )}
      {vista === 'panel' && <Panel mes={mes} oscuro={oscuro} onIrA={irA} />}
      {vista === 'movimientos' && <Movimientos mes={mes} onEditarGasto={setEditGasto} onEditarMovimiento={setEditMov} />}
      {vista === 'cuentas' && <Cuentas mes={mes} />}
      {vista === 'analisis' && <Analisis mes={mes} oscuro={oscuro} />}
      {vista === 'proyeccion' && <Proyeccion mes={mes} />}
      {vista === 'ajustes' && <Ajustes />}

      {(registrar || editGasto || editMov) && (
        <Registrar open onClose={cerrar} gasto={editGasto} movimiento={editMov} />
      )}
    </Layout>
  )
}
