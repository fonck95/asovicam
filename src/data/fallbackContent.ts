import type { SiteContent } from '../types/content';
import { programs } from './programs';
import { impactStats } from './impact';
import { teamMembers } from './team';
import { testimonials } from './testimonials';
import { faqItems } from './faq';
import { crops } from './crops';

/**
 * Contenido estático de respaldo: es lo que se muestra cuando la API de
 * contenido no responde (red caída, previews sin CORS, 5xx) o cuando una
 * colección del CMS aún no tiene elementos publicados. Mantiene el sitio
 * completo en cualquier circunstancia.
 */
export const fallbackContent: SiteContent = {
  settings: {
    contact: {
      phone: '+57 316 557 0682',
      email: 'asovicam2023@gmail.com',
      address: 'Ciénaga de Barbacoas, Yondó, Antioquia',
    },
    social: {},
    hero: {
      badge: 'Ciénaga de Barbacoas, Yondó · Magdalena Medio',
      title: 'Cultivando tradición,',
      highlight: 'sembrando futuro.',
      subtitle:
        'Somos ASOVICAM, la Asociación Campesina Vida en el Campo. ' +
        'Rescatamos el sistema ancestral de la milpa — maíz, frijol caupí ' +
        'y sandía — con técnica de mulch para una agricultura sostenible en ' +
        'el corazón del Magdalena Medio colombiano.',
    },
    seo: {},
  },
  programs: programs.map((p) => ({
    ...p,
    icon: p.icon as 'leaf' | 'wheat' | 'book' | 'tree',
  })),
  impactStats,
  teamMembers,
  testimonials,
  faqs: faqItems,
  crops,
  // Sin equivalente estático en este shape: la Home y la Galería tienen su
  // propio contenido local cuando estas colecciones llegan vacías.
  homeSlides: [],
  gallery: [],
};
