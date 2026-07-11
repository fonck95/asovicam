import { createContext, useContext } from 'react';
import type { ContentBundle, SiteContent } from '../types/content';
import { normalizeContentBundle } from '../lib/api';
import { fallbackContent } from '../data/fallbackContent';

export const ContentContext = createContext<SiteContent>(fallbackContent);

/** Contenido del sitio (API con fallback estático), disponible en toda la app. */
export function useContent(): SiteContent {
  return useContext(ContentContext);
}

/** Descarta claves sin valor útil (no-string o string vacío) de un bloque de settings. */
function cleanSettings<T extends object>(block: T): Partial<T> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(block)) {
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * Resuelve el bundle de la API contra el contenido estático: cada colección
 * usa los elementos publicados si existen y conserva el respaldo local si
 * llega vacía (el CMS puede estar recién estrenado), y los settings aplican
 * fallback campo a campo como exige el contrato.
 */
export function mergeContent(bundle: ContentBundle): SiteContent {
  const f = fallbackContent;
  return {
    settings: {
      contact: { ...f.settings.contact, ...cleanSettings(bundle.settings.contact) },
      social: cleanSettings(bundle.settings.social),
      hero: { ...f.settings.hero, ...cleanSettings(bundle.settings.hero) },
      seo: cleanSettings(bundle.settings.seo),
    },
    programs: bundle.programs.length ? bundle.programs : f.programs,
    impactStats: bundle.impactStats.length ? bundle.impactStats : f.impactStats,
    teamMembers: bundle.teamMembers.length ? bundle.teamMembers : f.teamMembers,
    testimonials: bundle.testimonials.length ? bundle.testimonials : f.testimonials,
    faqs: bundle.faqs.length ? bundle.faqs : f.faqs,
    crops: bundle.crops.length ? bundle.crops : f.crops,
    homeSlides: bundle.homeSlides,
    gallery: bundle.gallery,
  };
}

// Última respuesta buena de la API, para pintar contenido fresco desde el
// primer render en visitas repetidas (la red la actualiza igual después).
const CACHE_KEY = 'asovicam:public-content:v1';

export function loadCachedBundle(): ContentBundle | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalizeContentBundle(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveCachedBundle(bundle: ContentBundle): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(bundle));
  } catch {
    // Sin localStorage (modo privado, cuota llena): la caché es opcional.
  }
}
