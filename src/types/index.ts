export interface CropInfo {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  benefits: string[];
  icon: string;
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface Testimonial {
  id: string;
  author: string;
  role: string;
  content: string;
}

export interface NavLink {
  label: string;
  path: string;
}

export interface Parcela {
  id: number;
  nombre: string;
  /** Área en hectáreas según el mapa oficial (null si el KML no la trae). */
  areaHa: number | null;
  /** Vértices [lat, lng] del polígono del lote. */
  coords: [number, number][];
  /** Punto [lat, lng] donde el mapa oficial ubica la etiqueta del lote. */
  centro: [number, number];
}

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}
