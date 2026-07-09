import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  /** Ruta de imagen para redes sociales; usa la imagen insignia por defecto. */
  image?: string;
  /** Evita que buscadores indexen la página (p. ej. 404). */
  noindex?: boolean;
}

const SITE_NAME = 'ASOVICAM';
const DEFAULT_IMAGE = '/img/milpa-1920.webp';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function SEO({ title, description, image, noindex = false }: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} — ${SITE_NAME}`;
    const url = `${window.location.origin}${window.location.pathname}`;
    const imageUrl = `${window.location.origin}${image ?? DEFAULT_IMAGE}`;

    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertCanonical(url);

    // Open Graph
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:locale', 'es_CO');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', imageUrl);

    // Twitter
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', imageUrl);

    if (noindex) {
      upsertMeta('name', 'robots', 'noindex');
    } else {
      removeMeta('name', 'robots');
    }
  }, [title, description, image, noindex]);

  return null;
}
