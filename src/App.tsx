import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Layout, VISTAS, type Vista } from './components/Layout'
import { Registrar } from './components/Registrar'
import { Pagate } from './components/Pagate'
import { ConfirmDialog, Modal, MonthPicker, Toaster } from './components/ui'
import { ListaAlertas } from './components/Alertas'
import { alertas as calcularAlertas } from './lib/calc'
import { toast } from './lib/feedback'
import { hoyISO, mesActual } from './lib/format'
import { irA, useUI } from './lib/ui'
import { Inicio } from './pages/Inicio'
import { Movimientos } from './pages/Movimientos'
import { useStore } from './store'

const Metas = lazy(() => import('./pages/Metas').then((m) => ({ default: m.Metas })))
const Cuentas = lazy(() => import('./pages/Cuentas').then((m) => ({ default: m.Cuentas })))
const Plan = lazy(() => import('./pages/Plan').then((m) => ({ default: m.Plan })))
const Analisis = lazy(() => import('./pages/Analisis').then((m) => ({ default: m.Analisis })))
const Datos = lazy(() => import('./pages/Datos').then((m) => ({ default: m.Datos })))
const Ajustes = lazy(() => import('./pages/Ajustes').then((m) => ({ default: m.Ajustes })))

/** Nombres de vistas de versiones anteriores. */
const ALIAS: Record<string, Vista> = { panel: 'inicio', proyeccion: 'plan' }

function vistaDesdeHash(): Vista {
  const h = window.location.hash.replace('#', '')
  const v = (ALIAS[h] ?? h) as Vista
  return VISTAS.some((x) => x.id === v) ? v : 'inicio'
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

const DESCARTADAS = 'control-financiero-alertas-descartadas'

function leerDescartadas(): string[] {
  try {
    const x = JSON.parse(localStorage.getItem(DESCARTADAS) ?? '{}') as { mes?: string; ids?: string[] }
    return x.mes === mesActual() ? (x.ids ?? []) : []
  } catch {
    return []
  }
}

export default function App() {
  const [vista, setVista] = useState<Vista>(vistaDesdeHash)
  const [mes, setMes] = useState(mesActual)
  const oscuro = useTema()
  const ui = useUI()
  const s = useStore()
  const [descartadas, setDescartadas] = useState<string[]>(leerDescartadas)

  useEffect(() => {
    const f = () => setVista(vistaDesdeHash())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  // Al abrir: registra los recurrentes automáticos vencidos.
  useEffect(() => {
    const n = useStore.getState().aplicarRecurrentesAutomaticos(hoyISO())
    if (n > 0) toast(n === 1 ? 'Se registró 1 movimiento fijo' : `Se registraron ${n} movimientos fijos`, { tono: 'info', detalle: 'Los marcaste para registrarse solos cuando llega la fecha.' })
  }, [])

  // Atajo de teclado: "N" abre el registro rápido.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        useUI.getState().abrirRegistro()
      }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  const listaAlertas = useMemo(() => calcularAlertas(s, hoyISO()), [s])
  const visibles = listaAlertas.filter((a) => !descartadas.includes(a.id))
  const importantes = visibles.filter((a) => a.tono !== 'info').length

  const descartar = useCallback((id: string) => {
    setDescartadas((prev) => {
      const ids = [...prev, id]
      try {
        localStorage.setItem(DESCARTADAS, JSON.stringify({ mes: mesActual(), ids }))
      } catch {
        /* sin almacenamiento */
      }
      return ids
    })
  }, [])

  const actual = VISTAS.find((v) => v.id === vista)!
  const conMes = ['movimientos', 'cuentas', 'plan', 'analisis'].includes(vista)

  return (
    <MotionConfig reducedMotion="user">
      <Layout vista={vista} onVista={(v) => irA(v)} onRegistrar={() => ui.abrirRegistro()} onAlertas={() => ui.setAlertas(true)} nAlertas={importantes} oscuro={oscuro}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-6">
          <div className="hidden md:block">
            <h1 className="text-[28px] font-extrabold tracking-tight leading-tight">{actual.nombre}</h1>
            <p className="text-sm text-muted">{actual.descripcion}</p>
          </div>
          {conMes && <MonthPicker mes={mes} onChange={setMes} />}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={vista} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
            <Suspense fallback={<div className="h-64 rounded-[1.25rem] bg-surface-2 animate-pulse" />}>
              {vista === 'inicio' && <Inicio oscuro={oscuro} alertas={visibles} onDescartar={descartar} />}
              {vista === 'movimientos' && <Movimientos mes={mes} />}
              {vista === 'metas' && <Metas />}
              {vista === 'cuentas' && <Cuentas mes={mes} />}
              {vista === 'plan' && <Plan mes={mes} />}
              {vista === 'analisis' && <Analisis mes={mes} oscuro={oscuro} />}
              {vista === 'datos' && <Datos mes={mes} />}
              {vista === 'ajustes' && <Ajustes />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </Layout>

      <Registrar />
      <Pagate />
      <Modal open={ui.alertas} onClose={() => ui.setAlertas(false)} title="Avisos">
        <ListaAlertas alertas={visibles} onDescartar={descartar} onIr={() => ui.setAlertas(false)} />
      </Modal>
      <ConfirmDialog />
      <Toaster />
    </MotionConfig>
  )
}
