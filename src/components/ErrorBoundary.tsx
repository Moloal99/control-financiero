import { Component, type ErrorInfo, type ReactNode } from 'react'

const CLAVE_DATOS = 'control-financiero-v1'
const CLAVE_REINTENTO = 'control-financiero-reintento-carga'

/** Error típico cuando una versión nueva reemplaza archivos que la pestaña abierta todavía pide. */
const esErrorDeCarga = (e: unknown) => /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i.test(String((e as Error)?.message ?? e))

/**
 * Si algo falla al dibujar la app, en lugar de una pantalla en blanco se muestra qué pasó,
 * se ofrece recargar y descargar los datos tal como están guardados (nunca se borran).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Control Financiero:', error, info.componentStack)
    // Una versión nueva cambió los archivos: se recarga una sola vez para tomar la versión actual.
    if (esErrorDeCarga(error)) {
      try {
        if (!sessionStorage.getItem(CLAVE_REINTENTO)) {
          sessionStorage.setItem(CLAVE_REINTENTO, '1')
          window.location.reload()
        }
      } catch {
        /* sin almacenamiento */
      }
    }
  }

  descargar = () => {
    let t = ''
    try {
      t = localStorage.getItem(CLAVE_DATOS) ?? ''
    } catch {
      /* sin almacenamiento */
    }
    const blob = new Blob([t || '{}'], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `datos-control-financiero-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-bg text-ink">
        <div className="card max-w-md w-full p-6 space-y-4">
          <h1 className="text-xl font-extrabold tracking-tight">Algo falló al abrir esta pantalla</h1>
          <p className="text-sm text-muted leading-relaxed">Tus datos siguen guardados en este dispositivo. Recarga la app; si vuelve a pasar, descarga tus datos y envíame el mensaje de abajo.</p>
          <pre className="text-xs bg-surface-2 rounded-xl p-3 whitespace-pre-wrap break-words max-h-40 overflow-auto">{String(error?.message ?? error)}</pre>
          <div className="flex flex-col sm:flex-row gap-2">
            <button className="btn btn-primary flex-1" onClick={() => window.location.reload()}>
              Recargar
            </button>
            <button className="btn btn-ghost flex-1" onClick={this.descargar}>
              Descargar mis datos
            </button>
          </div>
          <button
            className="text-sm font-bold text-primary"
            onClick={() => {
              window.location.hash = 'inicio'
              this.setState({ error: null })
            }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }
}
