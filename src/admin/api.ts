// In production the API lives on api.asovicam.org. In local development this
// stays empty and Vite proxies /api and /auth, preserving the session cookie.
export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ??
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ??
  ''

export class ApiError extends Error {
  status: number
  details?: unknown
  referencedBy?: { resource: string; id: string; label: string }[]

  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.details = extra?.details
    this.referencedBy = extra?.referencedBy as ApiError['referencedBy']
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (res.status === 204) return undefined as T
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('asovicam:unauthenticated'))
    throw new ApiError(res.status, (body.error as string) ?? `Error ${res.status}`, body)
  }
  return body as T
}

/** Envía binarios conservando la cookie y reporta progreso real de subida. */
export function uploadBinary<T>(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${path}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onerror = () => reject(new ApiError(0, 'No se pudo conectar con el servidor'))
    xhr.onload = () => {
      let body: Record<string, unknown> = {}
      try { body = JSON.parse(xhr.responseText) as Record<string, unknown> } catch { /* respuesta vacía */ }
      if (xhr.status < 200 || xhr.status >= 300) {
        if (xhr.status === 401) window.dispatchEvent(new Event('asovicam:unauthenticated'))
        reject(new ApiError(xhr.status, (body.error as string) ?? `Error ${xhr.status}`, body))
      } else resolve(body as T)
    }
    xhr.send(file)
  })
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path: string) => request<void>(path, { method: 'DELETE' }),
}

export interface SessionUser {
  email: string
  name: string
  picture: string
}

export interface MediaItem {
  id: string
  key: string
  url: string
  mime: string
  size: number
  width?: number
  height?: number
  alt: string
  kind: 'image' | 'document' | 'video'
  uploadedBy: string
  createdAt: string
}

export interface MediaRefValue {
  mediaId: string
  url: string
  alt: string
}

export interface ResourceItem {
  id: string
  order: number
  published: boolean
  updatedBy: string
  updatedAt: string
  [key: string]: unknown
}

export interface SettingsData {
  contact: { phone: string; email: string; address: string; whatsapp: string }
  social: { facebook: string; instagram: string; youtube: string; tiktok: string; x: string }
  hero: { badge: string; title: string; highlight: string; subtitle: string }
  seo: { defaultTitle: string; defaultDescription: string }
}

export interface ContactMessageItem {
  id: string
  name: string
  email: string
  subject: string
  message: string
  read: boolean
  createdAt: string
}

export interface Asociado {
  id: string
  nombre: string
  cedula: string
  fechaNacimiento: string // 'AAAA-MM-DD' o '' (sin dato)
  telefono: string
  correo: string
  genero: '' | 'femenino' | 'masculino' | 'otro'
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface AsociadosList {
  items: Asociado[]
  total: number
  page: number
  limit: number
  pages: number
}

export type Coordinate = { lng: number; lat: number }
export type MapaPolygon = { polygonId: string; numero: string; coordenadas: Coordinate[][]; vecinos: string[] }
export interface Mapa {
  id: string; nombre: string; descripcion: string; estado: 'borrador' | 'finalizado'
  poligonos: MapaPolygon[]; sorteoId: string | null; finalizadoAt: string | null
  updatedBy: string; createdAt: string; updatedAt: string
}
export interface AgrupacionMember { _id?: string; id?: string; nombre: string; cedula: string }
export interface Agrupacion {
  id: string; nombre: string; descripcion: string; asociadoIds: Array<string | AgrupacionMember>
  updatedBy: string; createdAt: string; updatedAt: string
}
export interface Asignacion {
  asignacionId: string; eventoId: string; tipo: 'individual' | 'agrupacion'; asociadoId: string
  agrupacionId: string | null; polygonId: string; numeroPoligono: string
  coordenadas: Coordinate[][]; sorteadoAt: string; sorteadoPor: string
}
export interface EventoSorteo {
  eventoId: string; requestId: string; tipo: 'individual' | 'agrupacion'; asociadoIds: string[]
  agrupacionId: string | null; polygonIds: string[]; creadoAt: string
}
export interface SorteoAdmin {
  id: string; mapaId: string; estado: 'en_progreso' | 'completado'; poligonosDisponibles: string[]
  asignaciones: Asignacion[]; eventos: EventoSorteo[]; iniciadoAt: string; completadoAt: string | null
  updatedBy: string; mapa?: Mapa
}

/** `row` es 1-based sobre el array `rows` enviado en la petición. */
export interface ImportRowError {
  row: number
  cedula?: string
  error: string
}

export interface ImportResult {
  total: number
  inserted: number
  updated: number
  unchanged: number
  failed: number
  errors: ImportRowError[]
}

/** Sube un archivo a R2 vía presign → PUT directo → confirm. */
export async function uploadMedia(file: File, alt: string): Promise<MediaItem> {
  const presign = await api.post<{ uploadUrl: string; key: string; publicUrl: string }>(
    '/api/admin/media/presign',
    { filename: file.name, mime: file.type, size: file.size },
  )
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!putRes.ok) {
    throw new ApiError(putRes.status, 'La subida directa a R2 falló')
  }
  return api.post<MediaItem>('/api/admin/media/confirm', { key: presign.key, alt })
}
