// =====================================================
// SECTIONS — Guion de la experiencia del MAÍZ (contenido + keyframes 3D).
// Es el guion por defecto; los demás cultivos viven en sectionsFrijol.js
// y sectionsSandia.js, y products.js los ensambla todos.
//
// Cada sección define:
//   • Texto del overlay (eyebrow, title, body, align).
//   • `cam`   : posición y target (lookAt) de la cámara.
//   • `model` : rotación Y objetivo y escala del modelo.
//   • `mood`  : intensidades de luz, exposición y color de fondo.
//   • `hotspots` (opcional): puntos 3D que aparecen en esa sección.
//
// El timeline maestro INTERPOLA estos keyframes con el scroll. Para
// recalibrar la "coreografía" basta con tocar estos números: cada uno
// es un mapeo directo scroll → propiedad 3D.
//
// Sistema de coordenadas (modelo maíz por defecto): el modelo está
// centrado en el origen, ocupa y∈[-1.05, 1.0] y radio ≈ 0.7–1.2.
// =====================================================

export const SECTIONS = [
  // ---- 0 · HERO: el producto entra (fade + scale), cámara establece ----
  {
    id: 'hero',
    align: 'center',
    eyebrow: 'ASOVICAM · Milpa viva',
    title: 'El maíz que\nsostiene la milpa',
    body: 'Una variedad criolla del Magdalena Medio. Desplázate para recorrerla en detalle.',
    cam: { pos: [0, 0.45, 6.6], target: [0, 0.12, 0] },
    model: { rotY: -0.55, scale: 0.82 },
    mood: { key: 2.6, fill: 1.1, rim: 1.4, accent: 0.0, exposure: 0.95, bg: '#070b0a' },
  },

  // ---- 1 · ANATOMÍA: se acerca y gira a 3/4 (visión general) ----
  {
    id: 'anatomia',
    align: 'left',
    eyebrow: 'Anatomía',
    title: 'Geometría real,\ngrano a grano',
    body: 'Cada grano es una malla 3D instanciada sobre el olote: proyecta sombra sobre sus vecinos y revela el relieve volumétrico de una mazorca madura.',
    cam: { pos: [3.3, 1.15, 4.0], target: [0, 0.1, 0] },
    model: { rotY: 0.35, scale: 1.0 },
    mood: { key: 3.4, fill: 1.4, rim: 1.7, accent: 0.3, exposure: 1.0, bg: '#0a1310' },
  },

  // ---- 2 · GRANOS: zoom macro a la zona central ----
  {
    id: 'granos',
    align: 'right',
    eyebrow: 'Detalle · Grano dent',
    title: 'Cerosidad y\nmicrofaceta',
    body: 'Materiales PBR con roughness no uniforme y un highlight de softbox ancho — la firma de la fotografía de producto. Toca los puntos para conocer cada parte.',
    cam: { pos: [2.35, 0.12, 2.75], target: [0, 0.02, 0] },
    model: { rotY: 1.15, scale: 1.08 },
    mood: { key: 3.8, fill: 1.2, rim: 1.6, accent: 0.7, exposure: 1.04, bg: '#0d130c' },
    hotspots: [
      { id: 'grano', position: [0.55, 0.15, 0.18], label: 'Grano dent', text: 'Endospermo amiláceo con la hendidura ("dent") característica al secar.' },
      { id: 'olote', position: [0.0, 0.55, 0.42], label: 'Olote', text: 'Raquis central cremoso donde se inserta cada grano en filas filotácticas.' },
    ],
  },

  // ---- 3 · BARBAS / PUNTA: la cámara mira hacia arriba ----
  {
    id: 'barbas',
    align: 'left',
    eyebrow: 'Detalle · Estilos',
    title: 'Las barbas\nque dan vida',
    body: 'Cada filamento de seda es el estilo de una flor: por él viaja el polen hasta cada óvulo. Sin barbas no hay grano.',
    cam: { pos: [1.6, 1.5, 3.05], target: [0, 0.82, 0] },
    model: { rotY: 2.0, scale: 1.0 },
    mood: { key: 3.0, fill: 1.6, rim: 2.1, accent: 0.4, exposure: 1.02, bg: '#0b1012' },
    hotspots: [
      { id: 'silk', position: [0.05, 1.0, 0.1], label: 'Barbas (silk)', text: 'Emergen del domo apical como continuación del tejido del olote.' },
    ],
  },

  // ---- 4 · HOJAS / BASE: ángulo bajo, las brácteas se abren ----
  {
    id: 'hojas',
    align: 'right',
    eyebrow: 'Detalle · Brácteas',
    title: 'Hojas que\nprotegen y nutren',
    body: 'Las brácteas envuelven la mazorca en tres niveles, con distribución en ángulo áureo. En la milpa, su materia orgánica vuelve al suelo.',
    cam: { pos: [2.7, -0.45, 3.05], target: [0, -0.5, 0] },
    model: { rotY: 2.85, scale: 1.0 },
    mood: { key: 3.2, fill: 1.5, rim: 1.8, accent: 0.5, exposure: 1.0, bg: '#0a120e' },
  },

  // ---- 5 · INTERACTIVA: el usuario orbita libremente ----
  {
    id: 'interactiva',
    align: 'center',
    eyebrow: 'Tú al mando',
    title: 'Explóralo\na tu manera',
    body: 'Arrastra para orbitar · usa la rueda para acercarte. Cuando sueltes, la cámara retoma el recorrido.',
    cam: { pos: [0, 0.6, 5.2], target: [0, 0.0, 0] },
    model: { rotY: 3.4, scale: 1.05 },
    mood: { key: 3.6, fill: 1.5, rim: 1.8, accent: 0.6, exposure: 1.03, bg: '#0a0f0e' },
    orbit: true, // ← activa OrbitControls (handoff suave del autoplay)
  },

  // ---- 6 · CIERRE / CTA: plano final, producto protagonista ----
  {
    id: 'cierre',
    align: 'center',
    eyebrow: 'Del campo a tu mesa',
    title: 'Cultivado en\nYondó, Antioquia',
    body: 'Producción asociativa y agroecológica. Conoce el resto de la milpa: frijol caupí y sandía.',
    cta: { label: 'Ver productos', href: '/productos' },
    cta2: { label: 'Contacto', href: '/contacto' },
    cam: { pos: [0, 0.3, 5.9], target: [0, 0.05, 0] },
    model: { rotY: 4.0, scale: 0.96 },
    mood: { key: 3.0, fill: 1.3, rim: 1.6, accent: 0.8, exposure: 1.0, bg: '#070b0a' },
  },
];
