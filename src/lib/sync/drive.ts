/**
 * Acceso a Google Drive desde el navegador, sin servidor.
 *
 * - Inicio de sesión con OAuth 2.0 para aplicaciones web del lado del cliente (redirección). Funciona también
 *   en la app instalada, donde las ventanas emergentes suelen fallar.
 * - Permiso "drive.appdata": la app solo ve su propia carpeta oculta en el Drive del usuario, no sus archivos.
 */

export const ALCANCE = 'https://www.googleapis.com/auth/drive.appdata'
const NOMBRE_ARCHIVO = 'control-financiero.json'
const CLAVE_TOKEN = 'control-financiero-drive-token'
const CLAVE_RETORNO = 'control-financiero-drive-retorno'

/** ID de cliente OAuth de Google. Se define al publicar (variable GOOGLE_CLIENT_ID del repositorio). */
export const CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''

interface Token {
  valor: string
  vence: number
}

export function tokenVigente(): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE_TOKEN) ?? 'null') as Token | null
    return t && t.vence > Date.now() + 60_000 ? t.valor : null
  } catch {
    return null
  }
}

export function olvidarToken() {
  try {
    localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    /* sin almacenamiento */
  }
}

function urlRetorno() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

/** Lleva a la pantalla de Google y vuelve a la app. `silencioso` intenta volver sin mostrar nada si ya diste permiso. */
export function iniciarSesion(opciones: { silencioso?: boolean; correo?: string } = {}) {
  if (!CLIENT_ID) throw new Error('Falta configurar el ID de cliente de Google.')
  const estado = Math.random().toString(36).slice(2)
  try {
    sessionStorage.setItem(CLAVE_RETORNO, JSON.stringify({ estado, hash: window.location.hash || '#inicio' }))
  } catch {
    /* sin almacenamiento */
  }
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: urlRetorno(),
    response_type: 'token',
    scope: ALCANCE,
    include_granted_scopes: 'true',
    state: estado,
  })
  if (opciones.silencioso) p.set('prompt', 'none')
  if (opciones.correo) p.set('login_hint', opciones.correo)
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`)
}

/**
 * Al volver de Google, la respuesta llega en el hash (#access_token=…). Se guarda el token y se restaura la
 * pantalla en la que estaba el usuario. Devuelve el resultado para avisarle. Debe llamarse antes de dibujar la app.
 */
export function procesarRetorno(): { ok: boolean; error?: string } | null {
  const h = window.location.hash
  if (!/(^#|&)(access_token|error)=/.test(h)) return null
  const p = new URLSearchParams(h.slice(1))
  let retorno: { estado?: string; hash?: string } = {}
  try {
    retorno = JSON.parse(sessionStorage.getItem(CLAVE_RETORNO) ?? '{}')
    sessionStorage.removeItem(CLAVE_RETORNO)
  } catch {
    /* sin almacenamiento */
  }
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}${retorno.hash ?? '#inicio'}`)
  if (retorno.estado && p.get('state') !== retorno.estado) return { ok: false, error: 'La respuesta de Google no coincide. Vuelve a intentarlo.' }
  const valor = p.get('access_token')
  if (!valor) return { ok: false, error: p.get('error') ?? 'No se pudo conectar' }
  const vence = Date.now() + Number(p.get('expires_in') ?? 3600) * 1000
  try {
    localStorage.setItem(CLAVE_TOKEN, JSON.stringify({ valor, vence } satisfies Token))
  } catch {
    /* sin almacenamiento */
  }
  return { ok: true }
}

export class SinPermiso extends Error {}

async function pedir(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
  if (r.status === 401 || r.status === 403) {
    olvidarToken()
    throw new SinPermiso(`Google respondió ${r.status}`)
  }
  if (!r.ok) throw new Error(`Drive respondió ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r
}

export async function correoDeLaCuenta(token: string): Promise<string | null> {
  try {
    const r = await pedir('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', token)
    return ((await r.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null
  } catch (e) {
    if (e instanceof SinPermiso) throw e
    return null
  }
}

export async function buscarArchivo(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${NOMBRE_ARCHIVO}' and trashed=false`)
  const r = await pedir(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`, token)
  const j = (await r.json()) as { files?: { id: string }[] }
  return j.files?.[0]?.id ?? null
}

export async function leerArchivo(token: string, id: string): Promise<unknown> {
  const r = await pedir(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, token)
  return r.json()
}

export async function guardarArchivo(token: string, id: string | null, contenido: unknown): Promise<string> {
  const cuerpo = JSON.stringify(contenido)
  if (id) {
    await pedir(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: cuerpo })
    return id
  }
  const limite = 'cf' + Math.random().toString(36).slice(2)
  const meta = JSON.stringify({ name: NOMBRE_ARCHIVO, parents: ['appDataFolder'], mimeType: 'application/json' })
  const body = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: application/json\r\n\r\n${cuerpo}\r\n--${limite}--`
  const r = await pedir('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', token, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body })
  return ((await r.json()) as { id: string }).id
}
