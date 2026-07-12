import type {
  ContactSettings,
  ContentBundle,
  HeroSettings,
  SeoSettings,
  SocialSettings,
} from '../types/content';

// Único punto donde el frontend conoce la URL del backend. El valor viene
// de VITE_API_URL (VITE_API_BASE_URL se conserva como compatibilidad); nunca hardcodear el
// dominio en otros archivos ni anteponerle "www.".
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ??
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ??
  '';

// El panel de administración solo puede autenticarse servido same-origin con
// la API (la cookie de sesión es SameSite=Lax y el CORS no admite PUT/DELETE
// cross-origin), así que TODO acceso admin del sitio apunta a esta URL — nunca
// a la ruta interna /admin del dominio público.
export const ADMIN_PANEL_URL: string = API_BASE_URL ? `${API_BASE_URL}/admin/` : '/admin';

// El CORS público del backend no admite credenciales: los fetch van siempre
// sin cookies (omit) y con timeout defensivo para no colgar el primer render.
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, credentials: 'omit', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Normaliza defensivamente un bundle recibido (de la red o de la caché
 * local): colecciones siempre array y settings siempre objeto, aunque el
 * backend cambie o la respuesta llegue mutilada.
 */
export function normalizeContentBundle(raw: unknown): ContentBundle {
  const data = asRecord(raw);
  const settings = asRecord(data.settings);
  return {
    settings: {
      contact: asRecord(settings.contact) as ContactSettings,
      social: asRecord(settings.social) as SocialSettings,
      hero: asRecord(settings.hero) as HeroSettings,
      seo: asRecord(settings.seo) as SeoSettings,
    },
    programs: asArray(data.programs),
    impactStats: asArray(data.impactStats),
    teamMembers: asArray(data.teamMembers),
    testimonials: asArray(data.testimonials),
    faqs: asArray(data.faqs),
    crops: asArray(data.crops),
    homeSlides: asArray(data.homeSlides),
    gallery: asArray(data.gallery),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  };
}

/**
 * Descarga el bundle completo del sitio. Devuelve `null` ante cualquier
 * fallo (red, CORS en previews, 5xx, timeout o JSON inválido): quien llama
 * usa entonces los datos estáticos de fallback y el sitio nunca se ve roto.
 */
export async function fetchPublicContent(): Promise<ContentBundle | null> {
  if (!API_BASE_URL) return null;
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/public/content`);
    if (!res.ok) return null;
    return normalizeContentBundle(await res.json());
  } catch (err) {
    console.warn('[asovicam] No se pudo cargar el contenido remoto:', err);
    return null;
  }
}

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactFieldErrors = Partial<
  Record<'name' | 'email' | 'subject' | 'message', string>
>;

export type ContactResult =
  | { ok: true }
  | {
      ok: false;
      /** 0 = fallo de red/timeout (la petición nunca llegó al backend). */
      status: number;
      /** Mensaje en español apto para mostrar al usuario. */
      error: string;
      fieldErrors?: ContactFieldErrors;
    };

const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';

/**
 * Envía el formulario de contacto a POST /api/public/contact.
 * Nunca lanza: todos los fallos se devuelven como `{ ok: false }` tipado.
 */
export async function sendContactMessage(payload: ContactPayload): Promise<ContactResult> {
  if (!API_BASE_URL) {
    return { ok: false, status: 0, error: NETWORK_ERROR_MESSAGE };
  }
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_BASE_URL}/api/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR_MESSAGE };
  }

  if (res.status === 201) return { ok: true };

  let body: Record<string, unknown> = {};
  try {
    body = asRecord(await res.json());
  } catch {
    // Sin cuerpo JSON: se usa el mensaje genérico según el código.
  }

  const error =
    typeof body.error === 'string' && body.error
      ? body.error
      : 'No se pudo enviar el mensaje, intenta de nuevo más tarde.';

  // details viene como zod flatten: { fieldErrors: { campo: [mensajes] } }.
  let fieldErrors: ContactFieldErrors | undefined;
  const details = asRecord(body.details);
  const rawFieldErrors = asRecord(details.fieldErrors);
  for (const field of ['name', 'email', 'subject', 'message'] as const) {
    const messages = rawFieldErrors[field];
    if (Array.isArray(messages) && typeof messages[0] === 'string') {
      fieldErrors = { ...fieldErrors, [field]: messages[0] };
    }
  }

  return { ok: false, status: res.status, error, fieldErrors };
}
