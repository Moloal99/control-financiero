import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { exportarDatos, useStore } from '../store'

import { COLORES } from '../lib/seed'
import { hoyISO, num, pct, uid } from '../lib/format'
import type { Datos, TipoCuenta } from '../types'
import { Card, Field } from '../components/ui'

function descargar(blob: Blob, nombre: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export function Ajustes() {
  const s = useStore()
  const [msg, setMsg] = useState<string | null>(null)
  const fileExcel = useRef<HTMLInputElement>(null)
  const fileJson = useRef<HTMLInputElement>(null)
  const totalPct = s.fondos.reduce((a, f) => a + f.porcentaje, 0)
  const totalPresupuesto = s.categorias.reduce((a, c) => a + c.presupuesto, 0)

  const aviso = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 6000)
  }

  const onExcel = async (f: File) => {
    try {
      const { importarExcel } = await import('../lib/excel')
      const r = importarExcel(await f.arrayBuffer(), exportarDatos(s))
      s.reemplazarTodo(r.datos)
      aviso(`Importado: ${r.gastos} gastos, ${r.movimientos} movimientos, ${r.categorias} categorías, ${r.cuentas} cuentas, ${r.fondos} fondos.${r.avisos.length ? ' ' + r.avisos.join(' ') : ''}`)
    } catch (e) {
      aviso(`No se pudo importar: ${(e as Error).message}`)
    }
  }
  const onJson = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as Datos
      if (!d.categorias || !d.gastos) throw new Error('El archivo no tiene el formato esperado')
      if (!confirm('Esto reemplazará todos los datos actuales por los del respaldo. ¿Continuar?')) return
      s.reemplazarTodo(d)
      aviso('Respaldo restaurado.')
    } catch (e) {
      aviso(`No se pudo restaurar: ${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-4">
      {msg && <div className="card p-3 text-sm bg-primary-soft/60 border-primary/30">{msg}</div>}

      <Card title="Parámetros" subtitle="Ingreso de referencia y supuestos de proyección">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Ingreso mensual (Bs)" hint="Se usa cuando un mes no tiene ingresos registrados">
            <input className="input" inputMode="decimal" value={s.ajustes.ingresoMensual} onChange={(e) => s.setAjustes({ ingresoMensual: num(e.target.value) })} />
          </Field>
          <Field label="Inflación mensual estimada (%)">
            <input className="input" inputMode="decimal" defaultValue={(s.ajustes.inflacionMensual * 100).toFixed(2)} onBlur={(e) => s.setAjustes({ inflacionMensual: num(e.target.value) / 100 })} />
          </Field>
          <Field label="Tema">
            <select className="input" value={s.ajustes.tema} onChange={(e) => s.setAjustes({ tema: e.target.value as Datos['ajustes']['tema'] })}>
              <option value="sistema">Según el sistema</option>
              <option value="claro">Claro</option>
              <option value="oscuro">Oscuro</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="Categorías y presupuesto"
        subtitle={`Presupuesto mensual total: Bs ${totalPresupuesto.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`}
        action={
          <button className="btn btn-ghost !min-h-9" onClick={() => s.guardarCategoria({ id: uid(), nombre: 'Nueva categoría', presupuesto: 0, color: COLORES[s.categorias.length % COLORES.length] })}>
            <Plus size={16} /> Agregar
          </button>
        }
      >
        <ul className="space-y-2">
          {s.categorias.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <select className="input !w-14 !px-1 !py-1 !min-h-10" value={c.color} onChange={(e) => s.guardarCategoria({ ...c, color: e.target.value })} style={{ background: c.color, color: '#fff' }} aria-label="Color">
                {COLORES.map((col, i) => (
                  <option key={col} value={col} style={{ background: col }}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <input className="input flex-1" value={c.nombre} onChange={(e) => s.guardarCategoria({ ...c, nombre: e.target.value })} />
              <input className="input !w-32 text-right num" inputMode="decimal" value={c.presupuesto} onChange={(e) => s.guardarCategoria({ ...c, presupuesto: num(e.target.value) })} aria-label="Presupuesto" />
              <button className="btn btn-ghost !border-0 !px-2 text-muted hover:text-bad" onClick={() => confirm(`¿Eliminar "${c.nombre}"? Los gastos quedarán sin categoría.`) && s.eliminarCategoria(c.id)} aria-label="Eliminar">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card
          title="Cuentas"
          subtitle="Saldo inicial y fecha a la que corresponde"
          action={
            <button className="btn btn-ghost !min-h-9" onClick={() => s.guardarCuenta({ id: uid(), nombre: 'Nueva cuenta', tipo: 'Banco', saldoInicial: 0, fechaSaldo: hoyISO() })}>
              <Plus size={16} /> Agregar
            </button>
          }
        >
          <ul className="space-y-2">
            {s.cuentas.map((c) => (
              <li key={c.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input className="input col-span-2 sm:col-span-1" value={c.nombre} onChange={(e) => s.guardarCuenta({ ...c, nombre: e.target.value })} />
                  <select className="input" value={c.tipo} onChange={(e) => s.guardarCuenta({ ...c, tipo: e.target.value as TipoCuenta })}>
                    {(['Banco', 'Efectivo', 'Billetera', 'Otro'] as TipoCuenta[]).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <input className="input text-right num" inputMode="decimal" value={c.saldoInicial} onChange={(e) => s.guardarCuenta({ ...c, saldoInicial: num(e.target.value) })} aria-label="Saldo inicial" />
                  <input className="input" type="date" value={c.fechaSaldo} onChange={(e) => s.guardarCuenta({ ...c, fechaSaldo: e.target.value })} aria-label="Fecha del saldo" />
                </div>
                <button className="btn btn-ghost !border-0 !px-2 text-muted hover:text-bad" onClick={() => confirm(`¿Eliminar la cuenta "${c.nombre}"?`) && s.eliminarCuenta(c.id)} aria-label="Eliminar">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Fondos (distribución del ingreso)"
          subtitle={Math.abs(totalPct - 1) < 0.0001 ? '✔ La distribución suma 100%' : `⚠ La distribución suma ${pct(totalPct, 1)}; debe sumar 100%`}
          action={
            <button className="btn btn-ghost !min-h-9" onClick={() => s.guardarFondo({ id: uid(), nombre: 'Nuevo fondo', porcentaje: 0, cuentaId: null, enSaldoNeto: true })}>
              <Plus size={16} /> Agregar
            </button>
          }
        >
          <ul className="space-y-2">
            {s.fondos.map((f) => (
              <li key={f.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                  <input className="input" value={f.nombre} onChange={(e) => s.guardarFondo({ ...f, nombre: e.target.value })} />
                  <div className="relative">
                    <input className="input text-right num !pr-7" inputMode="decimal" value={Math.round(f.porcentaje * 1000) / 10} onChange={(e) => s.guardarFondo({ ...f, porcentaje: num(e.target.value) / 100 })} aria-label="Porcentaje" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
                  </div>
                  <select className="input" value={f.cuentaId ?? ''} onChange={(e) => s.guardarFondo({ ...f, cuentaId: e.target.value || null })}>
                    <option value="">Sin cuenta</option>
                    {s.cuentas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs flex items-center gap-1.5 px-1">
                    <input type="checkbox" checked={f.enSaldoNeto} onChange={(e) => s.guardarFondo({ ...f, enSaldoNeto: e.target.checked })} /> En saldo neto
                  </label>
                </div>
                <button className="btn btn-ghost !border-0 !px-2 text-muted hover:text-bad" onClick={() => confirm(`¿Eliminar el fondo "${f.nombre}"?`) && s.eliminarFondo(f.id)} aria-label="Eliminar">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title="Métodos de pago"
        action={
          <button className="btn btn-ghost !min-h-9" onClick={() => s.guardarMetodo({ id: uid(), nombre: 'Nuevo método' })}>
            <Plus size={16} /> Agregar
          </button>
        }
      >
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {s.metodos.map((m) => (
            <li key={m.id} className="flex items-center gap-1">
              <input className="input" value={m.nombre} onChange={(e) => s.guardarMetodo({ ...m, nombre: e.target.value })} />
              <button className="btn btn-ghost !border-0 !px-2 text-muted hover:text-bad" onClick={() => s.eliminarMetodo(m.id)} aria-label="Eliminar">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Datos" subtitle="Tus datos se guardan solo en este dispositivo (navegador). Haz respaldos y llévalos al otro dispositivo.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <button className="btn btn-ghost" onClick={() => fileExcel.current?.click()}>
            <FileSpreadsheet size={16} /> Importar Excel (.xlsm/.xlsx)
          </button>
          <button className="btn btn-ghost" onClick={async () => descargar((await import('../lib/excel')).exportarExcel(exportarDatos(s)), `control-financiero-${hoyISO()}.xlsx`)}>
            <Download size={16} /> Exportar a Excel
          </button>
          <button className="btn btn-ghost" onClick={() => descargar(new Blob([JSON.stringify(exportarDatos(s), null, 2)], { type: 'application/json' }), `respaldo-${hoyISO()}.json`)}>
            <Download size={16} /> Respaldo (JSON)
          </button>
          <button className="btn btn-ghost" onClick={() => fileJson.current?.click()}>
            <Upload size={16} /> Restaurar respaldo
          </button>
        </div>
        <input ref={fileExcel} type="file" accept=".xlsm,.xlsx,.xls" hidden onChange={(e) => e.target.files?.[0] && onExcel(e.target.files[0]).then(() => (e.target.value = ''))} />
        <input ref={fileJson} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && onJson(e.target.files[0]).then(() => (e.target.value = ''))} />
        <p className="text-xs text-muted mt-3">
          La importación de Excel lee las hojas Presupuesto, Cuentas, Distribución, Registro y Movimientos del libro RegistroGastosMensual y las combina con lo que ya tienes (sin duplicar).
        </p>
        <div className="mt-4 pt-4 border-t border-line">
          <button className="btn btn-danger" onClick={() => confirm('Se borrarán todos los gastos, movimientos y configuración. ¿Seguro?') && s.restablecer()}>
            Restablecer todo
          </button>
        </div>
      </Card>
    </div>
  )
}
