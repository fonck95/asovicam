// =====================================================
// PRODUCTS — Registro de los cultivos disponibles en la Experiencia 3D.
//
// La experiencia dejó de ser "solo maíz": ahora cada producto de la milpa
// (maíz, frijol caupí y sandía) tiene su propio GUION (sections*.js) y su
// MODELO procedural. Este archivo une ambos y añade el "tuning" de encuadre
// que el Stage necesita para que cada modelo —de tamaños y orientaciones
// muy distintos— quede bien presentado y "apoyado" sobre la sombra.
//
// Cada producto define:
//   • id          : slug de la ruta (/experiencia/:id) y clave del switcher.
//   • label/icon  : etiqueta y emoji para el selector y el SEO.
//   • scientific  : nombre científico (para el SEO de la página).
//   • modelId     : qué modelo procedural renderiza ProtagonistModel.
//   • accent      : color de acento de marca por producto.
//   • baseScale   : escala base del modelo (normaliza el tamaño en pantalla;
//                   la `model.scale` de cada sección la multiplica).
//   • groundY     : altura del plano de ContactShadows (apoya el modelo).
//   • yOffset     : desplazamiento vertical del modelo en el mundo.
//   • sections    : el guion scroll-driven de ESE producto.
// =====================================================

import { SECTIONS as maizSections } from './sections';
import { frijolSections } from './sectionsFrijol';
import { sandiaSections } from './sectionsSandia';

export const PRODUCTS = [
  {
    id: 'maiz',
    label: 'Maíz',
    icon: '🌽',
    scientific: 'Zea mays',
    seoDescription:
      'Recorre en 3D el maíz criollo de ASOVICAM con una experiencia inmersiva scroll-driven: cámara, luz y detalle sincronizados con tu desplazamiento.',
    modelId: 'maiz',
    accent: '#f59e0b',
    // Modelo vertical y esbelto (y∈[-1.05, 1.0], radio ≈0.7): escala 1.
    baseScale: 1.0,
    groundY: -1.05,
    yOffset: 0,
    sections: maizSections,
  },
  {
    id: 'frijol',
    label: 'Frijol Caupí',
    icon: '🫘',
    scientific: 'Vigna unguiculata',
    seoDescription:
      'Recorre en 3D el frijol caupí de ASOVICAM con una experiencia inmersiva scroll-driven: la leguminosa que fija nitrógeno y nutre el suelo de la milpa.',
    modelId: 'frijol',
    accent: '#84cc16',
    // Planta horizontal (≈2.5 de ancho): bajamos la escala para que entre
    // cómoda incluso en móvil vertical y subimos la sombra (la vaina queda
    // más alta que el maíz).
    baseScale: 0.82,
    groundY: -0.5,
    yOffset: 0,
    sections: frijolSections,
  },
  {
    id: 'sandia',
    label: 'Sandía',
    icon: '🍉',
    scientific: 'Citrullus lanatus',
    seoDescription:
      'Recorre en 3D la sandía de ASOVICAM con una experiencia inmersiva scroll-driven: corteza, pulpa y semillas con materiales PBR y subsurface scattering.',
    modelId: 'sandia',
    accent: '#ef4444',
    // Composición ancha (entera + rebanada ≈4.6 de ancho): escala reducida
    // para encuadrar ambas piezas incluso en móvil vertical; sombra a media
    // altura del elipsoide.
    baseScale: 0.47,
    groundY: -0.6,
    yOffset: 0,
    sections: sandiaSections,
  },
];

export const PRODUCT_MAP = PRODUCTS.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, /** @type {Record<string, typeof PRODUCTS[number]>} */ ({}));

export const DEFAULT_PRODUCT_ID = 'maiz';

// Resuelve un slug de ruta a un producto válido. Cae al maíz si no existe
// (p.ej. /experiencia o /experiencia/algo-invalido).
export function getProduct(id) {
  return PRODUCT_MAP[id] ?? PRODUCT_MAP[DEFAULT_PRODUCT_ID];
}

// ¿La ruta es el RECORRIDO COMPLETO (los tres cultivos encadenados)?
// /experiencia (sin slug) o un slug inválido → recorrido. Un slug de cultivo
// válido → experiencia individual de ese cultivo.
export function isTourRoute(id) {
  return !id || !PRODUCT_MAP[id];
}

// Normaliza las secciones de un cultivo para el Stage/Overlay UNIFICADOS:
//   • prefija el id con el cultivo (`maiz-hero`…) → único en todo el recorrido
//     y deja que el CSS apunte a `[id$="-interactiva"]`.
//   • adjunta productId/modelId/groundY/yOffset/accent para que el Stage sepa
//     qué modelo mostrar y a qué altura apoyar la sombra en cada tramo.
//   • PLIEGA baseScale dentro de model.scale: así el timeline usa un único
//     keyframe de escala continuo y el Stage trabaja siempre con baseScale = 1
//     (cada cultivo tiene tamaños muy distintos: maíz 1.0, frijol 0.82,
//     sandía 0.47).
function decorateSections(product) {
  return product.sections.map((s) => ({
    ...s,
    id: `${product.id}-${s.id}`,
    productId: product.id,
    modelId: product.modelId,
    groundY: product.groundY,
    yOffset: product.yOffset,
    accent: product.accent,
    model: { ...s.model, scale: s.model.scale * product.baseScale },
  }));
}

// Guion para la ruta /experiencia[/...]:
//   • cultivo válido → SOLO ese cultivo (deep-link individual).
//   • sin slug        → RECORRIDO COMPLETO: maíz → frijol → sandía encadenados
//     en una sola presentación scroll-driven (sin clics entre cultivos).
export function getExperienceSections(id) {
  if (id && PRODUCT_MAP[id]) return decorateSections(PRODUCT_MAP[id]);
  return PRODUCTS.flatMap(decorateSections);
}
