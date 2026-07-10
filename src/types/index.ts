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

/** Un lote sorteable de cualquier mapa (predeterminado o KML/KMZ subido). */
export interface Lote {
  nombre: string;
  /** Área en hectáreas (null si no se conoce). */
  areaHa: number | null;
  /** Vértices [lat, lng] del polígono del lote. */
  coords: [number, number][];
  /** Punto [lat, lng] donde ubicar la etiqueta del lote. */
  centro: [number, number];
}

/** Conjunto de lotes listos para sortear, con su lindero opcional. */
export interface MapaSorteo {
  nombre: string;
  lotes: Lote[];
  /** Vértices [lat, lng] del lindero del predio, si el mapa lo trae. */
  limite: [number, number][] | null;
}

export interface Parcela extends Lote {
  id: number;
}

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}
