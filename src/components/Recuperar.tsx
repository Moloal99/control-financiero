import { Download, History, LifeBuoy, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { CLAVE_RECUPERACION, CLAVE_RESPALDO_MIGRACION, exportarDatos, useStore } from '../store'
import { migrar, normalizar } from '../lib/migrar'
import { buscarCopias, contarRegistros, NOMBRE_ORIGEN, type Copia } from '../lib/respaldo'
import { confirmar, toast } from '../lib/feedback'
import { Card, Empty, Modal } from './ui'

const CLAVES = { recuperacion: CLAVE_RECUPERACION, antesDeActualizar: CLAVE_RESPALDO_MIGRACION }

function fechaHora(iso: string) {
  const d = new Date(iso)
  if (d.getFullYear() < 2000) return 'fecha desconocida'
  return d.toLocaleString('es-BO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Convierte una copia al formato actual (las de antes de la actualización se migran). */
function datosDeCopia(c: Copia) {
  if (c.origen === 'antes-de-actualizar') {
    try {
      const t = localStorage.getItem(CLAVE_RESPALDO_MIGRACION)
      const version = t ? Number((JSON.parse(t) as { version?: number }).version ?? 0) : 0
      return migrar(c.datos, version).datos
    } catch {
      return normalizar(c.datos)
    }
  }
  return normalizar(c.datos)
}

function descargarCopia(c: Copia) {
  const blob = new Blob([JSON.stringify(c.datos, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `copia-control-financiero-${c.guardado.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export async function restaurarCopia(c: Copia): Promise<boolean> {
  const s = useStore.getState()
  const actuales = s.gastos.length + s.movimientos.length
  if (
    !(await confirmar(`¿Restaurar la copia del ${fechaHora(c.guardado)}?`, {
      texto: `Tiene ${c.registros} registros. Reemplaza lo que ves ahora${actuales ? ` (${actuales} registros)` : ''}. Podrás deshacerlo desde el aviso de abajo.`,
      aceptar: 'Restaurar',
    }))
  )
    return false
  const anterior = exportarDatos(s)
  s.reemplazarTodo(datosDeCopia(c))
  toast('Datos restaurados', { detalle: `${c.registros} registros recuperados`, accion: { texto: 'Deshacer', onClick: () => useStore.getState().reemplazarTodo(anterior) }, duracion: 10000 })
  return true
}

function ListaCopias({ copias, onRestaurada }: { copias: Copia[]; onRestaurada?: () => void }) {
  return (
    <ul className="space-y-2">
      {copias.map((c) => (
        <li key={`${c.origen}-${c.guardado}`} className="rounded-2xl border border-line p-3 flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{fechaHora(c.guardado)}</p>
            <p className="text-xs text-muted">
              {NOMBRE_ORIGEN[c.origen]}, <b className="num text-ink">{c.registros}</b> registros
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={() => descargarCopia(c)} aria-label="Descargar esta copia">
              <Download size={15} />
            </button>
            <button
              className="btn btn-primary !min-h-9 !px-3 text-sm"
              onClick={async () => {
                if (await restaurarCopia(c)) onRestaurada?.()
              }}
            >
              <RotateCcw size={15} /> Restaurar
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Al abrir la app: si los datos actuales están vacíos (o tienen mucho menos) y hay una copia con más, se ofrece restaurarla. */
export function AvisoRecuperar() {
  const [copias, setCopias] = useState<Copia[]>([])
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    let vivo = true
    void buscarCopias(CLAVES).then((lista) => {
      if (!vivo) return
      const s = useStore.getState()
      const actuales = contarRegistros(s)
      const mejor = Math.max(0, ...lista.map((c) => c.registros))
      let descartado = false
      try {
        descartado = sessionStorage.getItem('control-financiero-recuperar-visto') === '1'
      } catch {
        /* sin almacenamiento */
      }
      // Se avisa solo cuando parece que se perdieron datos: hay una copia con bastantes más registros que ahora.
      if (!descartado && mejor > 0 && actuales < mejor * 0.5) {
        setCopias(lista.filter((c) => c.registros > actuales))
        setAbierto(true)
      }
    })
    return () => {
      vivo = false
    }
  }, [])
  const cerrar = () => {
    setAbierto(false)
    try {
      sessionStorage.setItem('control-financiero-recuperar-visto', '1')
    } catch {
      /* sin almacenamiento */
    }
  }
  return (
    <Modal open={abierto} onClose={cerrar} title="Encontramos tus datos">
      <div className="space-y-4">
        <div className="flex gap-3 items-start rounded-2xl bg-primary-soft/60 p-3.5">
          <LifeBuoy size={22} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            La app abrió con menos registros de los que tenías. En este teléfono hay {copias.length === 1 ? 'una copia' : `${copias.length} copias`} de tus datos. Restaura la más reciente para recuperarlos.
          </p>
        </div>
        <ListaCopias copias={copias} onRestaurada={cerrar} />
        <button className="btn btn-ghost w-full" onClick={cerrar}>
          Ahora no
        </button>
      </div>
    </Modal>
  )
}

/** Tarjeta para Datos: lista de copias automáticas guardadas en el dispositivo. */
export function CopiasGuardadas() {
  const [copias, setCopias] = useState<Copia[] | null>(null)
  const cargar = useCallback(() => {
    void buscarCopias(CLAVES).then(setCopias)
  }, [])
  useEffect(cargar, [cargar])
  return (
    <Card icon={History} title="Copias automáticas" subtitle="La app guarda una copia por día en este dispositivo. Si algo sale mal, restaura una desde aquí.">
      {copias === null ? null : copias.length === 0 ? (
        <Empty>Todavía no hay copias. Se crea la primera en cuanto tengas registros.</Empty>
      ) : (
        <ListaCopias copias={copias} onRestaurada={cargar} />
      )}
    </Card>
  )
}
