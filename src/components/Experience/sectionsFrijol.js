// =====================================================
// SECTIONS · FRIJOL CAUPÍ — Guion de la experiencia.
//
// Misma estructura que sections.js (maíz). Cada sección define texto del
// overlay + keyframes 3D (cámara, modelo, mood, hotspots).
//
// Sistema de coordenadas del modelo (BeanModel): la planta es HORIZONTAL.
// La vaina cerrada se extiende a lo largo del eje X (x∈[-0.98, 0.98]) a
// z=+0.32; la vaina ABIERTA con las semillas vive detrás, a z=-0.36; las
// hojas trifoliadas y el tallo suben hacia la izquierda (x≈-1.4, y≈0.55).
// Envolvente aproximada: x∈[-1.5, 1.0], y∈[-0.3, 0.65], z∈[-0.5, 0.5].
//
// Como la vaina abierta mira a -Z, las secciones de "semilla" giran el
// modelo ~180° (rotY≈3.0) para presentar las semillas hacia la cámara.
// =====================================================

export const frijolSections = [
  // ---- 0 · HERO: la vaina entra de frente ----
  {
    id: 'hero',
    align: 'center',
    eyebrow: 'ASOVICAM · Milpa viva',
    title: 'El frijol que\nnutre la tierra',
    body: 'Caupí criollo del Magdalena Medio: la leguminosa que fija nitrógeno y sostiene el suelo. Desplázate para recorrerla en detalle.',
    cam: { pos: [0, 0.4, 6.6], target: [-0.1, 0.12, 0] },
    model: { rotY: -0.45, scale: 0.92 },
    mood: { key: 2.6, fill: 1.1, rim: 1.4, accent: 0.0, exposure: 0.95, bg: '#070d0a' },
  },

  // ---- 1 · ANATOMÍA: vista general 3/4 (vaina + hojas) ----
  {
    id: 'anatomia',
    align: 'left',
    eyebrow: 'Anatomía',
    title: 'Vaina, semilla\ny hoja',
    body: 'Una vaina alargada que se abre por la sutura dorsal y revela las semillas en fila. Arriba, las hojas trifoliadas características de Vigna unguiculata.',
    cam: { pos: [3.4, 1.25, 4.3], target: [-0.1, 0.12, 0] },
    model: { rotY: 0.32, scale: 1.0 },
    mood: { key: 3.4, fill: 1.4, rim: 1.7, accent: 0.3, exposure: 1.0, bg: '#0a1310' },
  },

  // ---- 2 · SEMILLAS: giro ~180° para mirar dentro de la vaina abierta ----
  {
    id: 'semillas',
    align: 'right',
    eyebrow: 'Detalle · Grano',
    title: 'Proteína\narriñonada',
    body: 'La semilla de caupí es reniforme, con su "ojo" (hilum) marcado. Testa cerosa con materiales PBR de clearcoat sutil. Toca los puntos para conocer cada parte.',
    cam: { pos: [1.5, 0.5, 3.2], target: [-0.1, 0.05, 0] },
    model: { rotY: 3.05, scale: 1.12 },
    mood: { key: 3.8, fill: 1.2, rim: 1.6, accent: 0.7, exposure: 1.04, bg: '#0b1410' },
    hotspots: [
      { id: 'semilla', position: [0.0, 0.0, -0.42], label: 'Semilla de caupí', text: 'Cotiledones ricos en proteína: la base nutricional que complementa al maíz en la milpa.' },
      { id: 'hilum', position: [0.45, 0.02, -0.40], label: 'Ojo (hilum)', text: 'Cicatriz donde la semilla se unía a la vaina. En el caupí "ojo negro" forma la mancha característica.' },
    ],
  },

  // ---- 3 · VAINA: detalle del cuerpo cerrado y su sutura ----
  {
    id: 'vaina',
    align: 'left',
    eyebrow: 'Detalle · Vaina',
    title: 'La cápsula\nque protege',
    body: 'La vaina envuelve y protege las semillas durante el llenado. Su sutura dorsal —más oscura— es la línea por donde se rasga al madurar y secar.',
    cam: { pos: [2.5, 0.55, 3.0], target: [0, 0.1, 0] },
    model: { rotY: 1.5, scale: 1.08 },
    mood: { key: 3.0, fill: 1.5, rim: 1.9, accent: 0.4, exposure: 1.02, bg: '#0b1012' },
    hotspots: [
      { id: 'sutura', position: [0.0, 0.24, 0.36], label: 'Sutura dorsal', text: 'Costura longitudinal por donde la vaina se abre. Recorre toda la cresta superior.' },
    ],
  },

  // ---- 4 · HOJAS / SUELO: ángulo bajo, el aporte agroecológico ----
  {
    id: 'hojas',
    align: 'right',
    eyebrow: 'Detalle · Hojas',
    title: 'Hojas que\nfijan nitrógeno',
    body: 'Sus raíces alojan bacterias Rhizobium que capturan nitrógeno del aire y lo entregan al suelo. Por eso el caupí fertiliza la milpa de forma natural.',
    cam: { pos: [2.6, -0.3, 3.3], target: [-0.2, 0.0, 0] },
    model: { rotY: 2.3, scale: 1.0 },
    mood: { key: 3.2, fill: 1.5, rim: 1.8, accent: 0.5, exposure: 1.0, bg: '#0a120e' },
    hotspots: [
      { id: 'hoja', position: [-1.25, 0.5, 0.08], label: 'Hoja trifoliada', text: 'Tres foliolos por hoja: el rasgo típico de la leguminosa. Translúcidas a contraluz.' },
    ],
  },

  // ---- 5 · INTERACTIVA: el usuario orbita libremente ----
  {
    id: 'interactiva',
    align: 'center',
    eyebrow: 'Tú al mando',
    title: 'Explóralo\na tu manera',
    body: 'Arrastra para orbitar · usa la rueda para acercarte. Cuando sueltes, la cámara retoma el recorrido.',
    cam: { pos: [0, 0.5, 5.2], target: [0, 0.05, 0] },
    model: { rotY: 3.5, scale: 1.05 },
    mood: { key: 3.6, fill: 1.5, rim: 1.8, accent: 0.6, exposure: 1.03, bg: '#0a0f0d' },
    orbit: true,
  },

  // ---- 6 · CIERRE / CTA ----
  {
    id: 'cierre',
    align: 'center',
    eyebrow: 'Del campo a tu mesa',
    title: 'Cultivado en\nYondó, Antioquia',
    body: 'Producción asociativa y agroecológica. Conoce el resto de la milpa: maíz criollo y sandía.',
    cta: { label: 'Ver productos', href: '/productos' },
    cta2: { label: 'Contacto', href: '/contacto' },
    cam: { pos: [0, 0.35, 5.7], target: [-0.05, 0.08, 0] },
    model: { rotY: 4.1, scale: 0.95 },
    mood: { key: 3.0, fill: 1.3, rim: 1.6, accent: 0.8, exposure: 1.0, bg: '#070d0a' },
  },
];
