import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { SiteContent } from '../types/content';
import { fetchPublicContent } from '../lib/api';
import { fallbackContent } from '../data/fallbackContent';
import {
  ContentContext,
  loadCachedBundle,
  mergeContent,
  saveCachedBundle,
} from './ContentContext';

/**
 * Carga el contenido del sitio desde GET /api/public/content al montar la
 * app. Arranca con la última respuesta cacheada (o el contenido estático) y
 * la reemplaza en silencio cuando la red responde; si la API falla, el
 * fallback queda puesto y el sitio nunca se ve roto.
 */
export default function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(() => {
    const cached = loadCachedBundle();
    return cached ? mergeContent(cached) : fallbackContent;
  });

  useEffect(() => {
    let cancelled = false;
    fetchPublicContent().then((bundle) => {
      if (bundle && !cancelled) {
        setContent(mergeContent(bundle));
        saveCachedBundle(bundle);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}
