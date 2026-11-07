import { motion } from 'motion/react'
import { Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSync, type EstadoSync } from '../lib/sync/motor'
import { irA } from '../lib/ui'
import { Card } from './ui'

function haceCuanto(iso?: string | null): string {
  if (!iso) return 'nunca'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })
}

const ICONO: Record<EstadoSync, LucideIcon> = {
  'sin-configurar': CloudOff,
  apagado: CloudOff,
  listo: CloudCheck,
  pendiente: Cloud,
  sincronizando: RefreshCw,
  reconectar: CloudAlert,
  error: CloudAlert,
}

const TEXTO: Record<EstadoSync, string> = {
  'sin-configurar': 'Sincronización no disponible',
  apagado: 'Sin sincronizar',
  listo: 'Sincronizado con Drive',
  pendiente: 'Cambios por subir',
  sincronizando: 'Sincronizando…',
  reconectar: 'Toca para reconectar Drive',
  error: 'No se pudo sincronizar',
}

/** Icono pequeño para la cabecera: muestra el estado y lleva a la configuración (o reconecta). */
export function IndicadorSync({ claro = false }: { claro?: boolean }) {
  const { estado, config, conectar } = useSync()
  if (estado === 'sin-configurar' || !config.activo) return null
  const Icono = ICONO[estado]
  const alerta = estado === 'reconectar' || estado === 'error'
  return (
    <button
      className={`btn btn-icon relative ${claro ? 'text-rail-ink hover:bg-white/8' : alerta ? 'text-warn' : 'text-muted'}`}
      onClick={() => (estado === 'reconectar' ? conectar() : irA('datos'))}
      aria-label={TEXTO[estado]}
      title={TEXTO[estado]}
    >
      <motion.span animate={estado === 'sincronizando' ? { rotate: 360 } : { rotate: 0 }} transition={estado === 'sincronizando' ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }} className="grid place-items-center">
        <Icono size={20} />
      </motion.span>
      {alerta && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-warn" />}
    </button>
  )
}

/** Tarjeta en "Importar y exportar" para conectar Google Drive. */
export function TarjetaSync() {
  const { estado, config, mensaje, conectar, desconectar, sincronizar } = useSync()
  const [, setTic] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTic((x) => x + 1), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const Icono = ICONO[estado]

  return (
    <Card icon={Cloud} title="Sincronizar con Google Drive" subtitle="Tus datos en el celular y la computadora, siempre iguales y con copia en tu Drive">
      {estado === 'sin-configurar' ? (
        <p className="text-sm text-muted leading-relaxed">
          Falta configurar el acceso a Google (el ID de cliente) al publicar la app. Cuando esté listo, aquí aparecerá el botón para conectar tu cuenta.
        </p>
      ) : !config.activo ? (
        <div className="space-y-3">
          <ul className="text-sm text-muted space-y-1.5 leading-relaxed list-disc pl-5">
            <li>Cada cambio se guarda en tu Google Drive, en una carpeta privada de la app que no ve nadie más.</li>
            <li>Abre la app en otro dispositivo con la misma cuenta y tendrás los mismos datos.</li>
            <li>Si un teléfono se borra o se pierde, tus registros siguen en Drive.</li>
          </ul>
          <button className="btn btn-primary w-full sm:w-auto" onClick={conectar}>
            <Cloud size={18} /> Conectar Google Drive
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3.5">
            <motion.span animate={estado === 'sincronizando' ? { rotate: 360 } : { rotate: 0 }} transition={estado === 'sincronizando' ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }} className={estado === 'reconectar' || estado === 'error' ? 'text-warn' : 'text-ok'}>
              <Icono size={22} />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm">{TEXTO[estado]}</p>
              <p className="text-xs text-muted truncate">
                {config.correo ? `${config.correo} · ` : ''}última vez {haceCuanto(config.ultima)}
              </p>
              {estado === 'error' && mensaje && <p className="text-xs text-warn mt-0.5 break-words">{mensaje}</p>}
              {estado === 'reconectar' && <p className="text-xs text-muted mt-0.5">Google pide confirmar de nuevo. Tus cambios siguen guardados aquí y se subirán al reconectar.</p>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {estado === 'reconectar' ? (
              <button className="btn btn-primary" onClick={conectar}>
                <Cloud size={17} /> Reconectar
              </button>
            ) : (
              <button className="btn btn-soft" onClick={() => void sincronizar({ avisar: true })} disabled={estado === 'sincronizando'}>
                <RefreshCw size={17} /> Sincronizar ahora
              </button>
            )}
            <button className="btn btn-ghost" onClick={desconectar}>
              Desconectar
            </button>
          </div>
          <p className="text-xs text-muted">Al desconectar, tus datos se quedan en este dispositivo y en tu Drive.</p>
        </div>
      )}
    </Card>
  )
}
