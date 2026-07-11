// Contrato de GET /api/public/content del backend (api.asovicam.org).
// Solo llegan elementos publicados, ya ordenados; todo el texto es plano
// (el backend lo sanea) y debe renderizarse como texto, nunca como HTML.

export interface PublicMediaRef {
  url: string;
  alt: string;
}

export interface ContactSettings {
  phone?: string;
  email?: string;
  address?: string;
  whatsapp?: string;
}

export interface SocialSettings {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  x?: string;
}

export interface HeroSettings {
  badge?: string;
  title?: string;
  highlight?: string;
  subtitle?: string;
}

export interface SeoSettings {
  defaultTitle?: string;
  defaultDescription?: string;
}

export interface PublicProgram {
  id: string;
  slug?: string;
  title: string;
  description: string;
  icon: 'leaf' | 'wheat' | 'book' | 'tree';
}

export interface PublicImpactStat {
  id: string;
  slug?: string;
  value: string;
  label: string;
  description: string;
}

export interface PublicTeamMember {
  id: string;
  slug?: string;
  name: string;
  role: string;
  description: string;
  /** null si el miembro no tiene foto cargada. */
  photo?: PublicMediaRef | null;
}

export interface PublicTestimonial {
  id: string;
  author: string;
  role: string;
  content: string;
}

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'milpa' | 'participacion';
}

export interface PublicCrop {
  id: string;
  slug?: string;
  name: string;
  scientificName: string;
  description: string;
  benefits: string[];
  icon: string;
  color: string;
}

export interface PublicHomeSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  accent: string;
  /** Nunca null: el backend no publica slides sin imagen. */
  image: PublicMediaRef;
}

export interface PublicGalleryItem {
  id: string;
  title: string;
  description: string;
  category: string;
  media: { url: string; alt: string; kind: 'image' | 'document' | 'video' };
}

export interface ContentBundle {
  settings: {
    // Los cuatro bloques pueden llegar como {} si nunca se han editado.
    contact: ContactSettings;
    social: SocialSettings;
    hero: HeroSettings;
    seo: SeoSettings;
  };
  programs: PublicProgram[];
  impactStats: PublicImpactStat[];
  teamMembers: PublicTeamMember[];
  testimonials: PublicTestimonial[];
  faqs: PublicFaq[];
  crops: PublicCrop[];
  homeSlides: PublicHomeSlide[];
  gallery: PublicGalleryItem[];
  updatedAt: string;
}

/**
 * Contenido ya resuelto que consume la UI: mismo shape que el bundle pero
 * con las colecciones garantizadas (fallback estático cuando la API no trae
 * elementos) y los ajustes de contacto/hero con valores por defecto.
 */
export interface SiteContent {
  settings: {
    contact: Required<Pick<ContactSettings, 'phone' | 'email' | 'address'>> &
      Pick<ContactSettings, 'whatsapp'>;
    social: SocialSettings;
    hero: Required<HeroSettings>;
    seo: SeoSettings;
  };
  programs: PublicProgram[];
  impactStats: PublicImpactStat[];
  teamMembers: PublicTeamMember[];
  testimonials: PublicTestimonial[];
  faqs: PublicFaq[];
  crops: PublicCrop[];
  /** Vacío si el CMS no tiene slides: la Home usa entonces sus slides locales. */
  homeSlides: PublicHomeSlide[];
  /** Vacío si el CMS no tiene galería: la página muestra sus placeholders. */
  gallery: PublicGalleryItem[];
}
