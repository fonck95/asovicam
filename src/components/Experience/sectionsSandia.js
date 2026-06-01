// =====================================================
// SECTIONS · SANDÍA — Guion de la experiencia.
//
// Misma estructura que sections.js (maíz). Cada sección define texto del
// overlay + keyframes 3D (cámara, modelo, mood, hotspots).
//
// Sistema de coordenadas del modelo (WatermelonModel, modo 'both'): es una
// composición ANCHA con dos piezas:
//   • Sandía entera  → centrada en x≈-0.95 (radio ≈1.3 en X), a la IZQUIERDA.
//   • Rebanada       → centrada en x≈+1.55, inclinada hacia la cámara, DERECHA.
// Envolvente aproximada (sin escalar): x∈[-2.27, 2.33], y∈[-1.18, 0.93].
//
// Por eso este producto usa un `baseScale` menor (ver products.js) que
// reduce la composición a un encuadre cómodo, y las rotaciones rotY se
// mantienen SUAVES para no descomponer la lectura entera+rebanada.
// =====================================================

export const sandiaSections = [
  // ---- 0 · HERO: la composición entera + rebanada, de frente ----
  {
    id: 'hero',
    align: 'center',
    eyebrow: 'ASOVICAM · Milpa viva',
    title: 'La sandía que\nrefresca la milpa',
    body: 'Charleston Gray cultivada en Yondó: cobertura viva del suelo y fruto dulce de alto valor. Desplázate para recorrerla en detalle.',
    cam: { pos: [0, 0.6, 7.4], target: [0.05, -0.05, 0] },
    model: { rotY: -0.15, scale: 1.0 },
    mood: { key: 3.0, fill: 1.2, rim: 1.5, accent: 0.0, exposure: 0.97, bg: '#08110b' },
  },

  // ---- 1 · ANATOMÍA: vista general 3/4 (entera + corte) ----
  {
    id: 'anatomia',
    align: 'left',
    eyebrow: 'Anatomía',
    title: 'Por fuera\ny por dentro',
    body: 'Una pieza completa junto a su rebanada: corteza rayada por fuera, pulpa roja jugosa por dentro. Geometría y materiales PBR coherentes entre ambas.',
    cam: { pos: [4.2, 1.9, 5.4], target: [0.05, -0.08, 0] },
    model: { rotY: 0.22, scale: 1.04 },
    mood: { key: 3.6, fill: 1.4, rim: 1.7, accent: 0.3, exposure: 1.0, bg: '#0a140d' },
  },

  // ---- 2 · PULPA: macro a la rebanada (subsurface scattering) ----
  {
    id: 'pulpa',
    align: 'right',
    eyebrow: 'Detalle · Pulpa',
    title: 'Rojo jugoso,\nluz que atraviesa',
    body: 'La pulpa usa transmisión + atenuación de color para simular cómo la luz se filtra por el tejido — el subsurface scattering de una sandía real. Toca los puntos.',
    cam: { pos: [2.7, 0.7, 3.5], target: [0.55, -0.05, 0] },
    model: { rotY: 0.0, scale: 1.12 },
    mood: { key: 3.9, fill: 1.3, rim: 1.6, accent: 0.7, exposure: 1.05, bg: '#120a0c' },
    hotspots: [
      { id: 'pulpa', position: [1.45, -0.1, 0.5], label: 'Pulpa', text: 'Tejido placentario lleno de agua y azúcar. Cada celda es una "joyita" que dispersa la luz.' },
      { id: 'corazon', position: [1.55, -0.35, 0.42], label: 'Corazón', text: 'El centro es la zona más madura y dulce, de rojo más profundo (vino).' },
    ],
  },

  // ---- 3 · SEMILLAS: detalle de las semillas embebidas en el corte ----
  {
    id: 'semillas',
    align: 'left',
    eyebrow: 'Detalle · Semillas',
    title: 'Semillas en\nlas placentas',
    body: 'Las semillas no se alinean en círculos: siguen las placentas carpelares que se proyectan desde el corazón. Testa lignificada con barniz natural.',
    cam: { pos: [2.2, 0.6, 3.0], target: [0.5, 0.05, 0] },
    model: { rotY: 0.05, scale: 1.18 },
    mood: { key: 4.0, fill: 1.2, rim: 1.5, accent: 0.6, exposure: 1.05, bg: '#100b0d' },
    hotspots: [
      { id: 'semilla', position: [1.4, -0.15, 0.55], label: 'Semilla', text: 'Lignificada y dieléctrica: el brillo viene de su barniz natural, no de un acabado metálico.' },
    ],
  },

  // ---- 4 · CÁSCARA: la pieza entera, foco en la corteza rayada ----
  {
    id: 'cascara',
    align: 'right',
    eyebrow: 'Detalle · Corteza',
    title: 'Rayas, cera\ny rocío',
    body: 'La corteza tiene franjas oscuras más enceradas, una mancha de campo donde reposó en el suelo y gotas de rocío de "recién lavada". Marcadores de madurez reales.',
    cam: { pos: [-2.6, 1.0, 4.4], target: [-0.45, 0.0, 0] },
    model: { rotY: 0.1, scale: 1.04 },
    mood: { key: 3.4, fill: 1.5, rim: 1.9, accent: 0.5, exposure: 1.0, bg: '#0a130d' },
    hotspots: [
      { id: 'cascara', position: [-0.95, 0.35, 0.7], label: 'Cáscara', text: 'Cutícula cerosa con franjas y moteado. La cera se concentra en las rayas oscuras.' },
      { id: 'campo', position: [-0.21, -0.47, 0.5], label: 'Mancha de campo', text: 'Zona amarilla donde el fruto reposó en la tierra. Más amarilla = más madura.' },
    ],
  },

  // ---- 5 · INTERACTIVA: el usuario orbita libremente ----
  {
    id: 'interactiva',
    align: 'center',
    eyebrow: 'Tú al mando',
    title: 'Explóralo\na tu manera',
    body: 'Arrastra para orbitar · usa la rueda para acercarte. Cuando sueltes, la cámara retoma el recorrido.',
    cam: { pos: [0, 0.8, 6.6], target: [0.05, -0.05, 0] },
    model: { rotY: 0.4, scale: 1.05 },
    mood: { key: 3.6, fill: 1.5, rim: 1.8, accent: 0.6, exposure: 1.03, bg: '#0a0f0d' },
    orbit: true,
  },

  // ---- 6 · CIERRE / CTA ----
  {
    id: 'cierre',
    align: 'center',
    eyebrow: 'Del campo a tu mesa',
    title: 'Cultivada en\nYondó, Antioquia',
    body: 'Producción asociativa y agroecológica. Conoce el resto de la milpa: maíz criollo y frijol caupí.',
    cta: { label: 'Ver productos', href: '/productos' },
    cta2: { label: 'Contacto', href: '/contacto' },
    cam: { pos: [0, 0.55, 7.0], target: [0.05, -0.05, 0] },
    model: { rotY: 0.6, scale: 0.98 },
    mood: { key: 3.0, fill: 1.3, rim: 1.6, accent: 0.8, exposure: 1.0, bg: '#08110b' },
  },
];
