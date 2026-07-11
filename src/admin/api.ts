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
