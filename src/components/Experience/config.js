import * as THREE from 'three';

// =====================================================
// CONFIG — Bloque único de parámetros editables.
// Toca SOLO este archivo para calibrar la experiencia:
// modelo, suavizado de scroll, easing, luces, post, tema.
// Cada valor está comentado con su efecto.
// =====================================================

export const CONFIG = {
  // ---------- MODELO PROTAGONISTA ----------
  // Los modelos de ASOVICAM son PROCEDURALES (se construyen con
  // primitivas Three.js, no son .glb). Elige cuál protagoniza la
  // experiencia: 'maiz' | 'frijol' | 'sandia'.
  MODEL_ID: 'maiz',

  // ¿Tienes un .glb propio? Pon aquí su ruta y reemplazará al modelo
  // procedural. Coloca el archivo en `public/models/` y referencia
  // p.ej. '/models/mi-modelo.glb'. Déjalo en null para usar el procedural.
  MODEL_URL: null,
  // Decoder DRACO (para .glb comprimidos con draco). CDN oficial de Google.
  // Si prefieres servirlo local, copia los decoders a public/draco/ y
  // pon '/draco/'.
  DRACO_PATH: 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',

  // Ajuste fino del encuadre del modelo (afecta a procedural y a .glb).
  MODEL_BASE_SCALE: 1, // escala base; el scroll la multiplica por stage.mscale
  MODEL_Y_OFFSET: 0, // sube/baja el modelo en el mundo

  // ---------- RENDER / RENDIMIENTO ----------
  DPR_DESKTOP: [1, 2], // pixel ratio capado a 2 (nunca render 4x en Retina)
  DPR_MOBILE: [1, 1.5], // móvil: tope más bajo para sostener 60fps
  MOBILE_BREAKPOINT: 820, // px de ancho por debajo de los cuales aplicamos modo móvil

  // ---------- SMOOTH SCROLL (Lenis) ----------
  // lerp más bajo = scroll más "pesado"/cinematográfico. 0.08–0.12 es el
  // rango premium. wheelMultiplier/touchMultiplier ajustan sensibilidad.
  LENIS: {
    lerp: 0.1,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    smoothWheel: true,
  },

  // ---------- SCROLL ↔ TIMELINE ----------
  // SCRUB = true → mapeo DIRECTO scroll→timeline (Lenis ya pone la inercia,
  // es lo que da la sensación "seamless"). Un número (p.ej. 0.6) añade un
  // suavizado extra de GSAP en segundos (útil si quieres aún más "peso").
  SCRUB: true,
  // Suavizado EXTRA de la cámara dentro del render loop (0..1). 1 = sigue
  // al scroll sin retraso; valores menores añaden "arrastre" sedoso.
  CAMERA_LERP: 0.14,
  // Damping (rapidez de convergencia) para escala/luces. Mayor = más rápido.
  DAMP: 5,
  // Easing premium por defecto de las transiciones entre secciones.
  EASE: 'power2.inOut',
  EASE_HERO: 'expo.out',

  // ---------- INTERACCIÓN ----------
  // Parallax sutil del puntero en secciones cinemáticas (desktop). El modelo
  // y la cámara se inclinan levemente hacia el cursor SIN pelear con el scroll.
  POINTER_PARALLAX: 0.18, // desplazamiento de cámara (unidades de mundo)
  POINTER_MODEL_TILT: 0.12, // inclinación del modelo (radianes)
  // Giro idle continuo del modelo en secciones cinemáticas (rad/s).
  IDLE_ROTATION_SPEED: 0.09,
  // OrbitControls de la sección interactiva.
  ORBIT: {
    minDistance: 2.4,
    maxDistance: 7.5,
    minPolar: Math.PI / 6, // no dejar mirar desde abajo del piso
    maxPolar: Math.PI / 1.9,
    autoRotateSpeed: 0.45,
    dampingFactor: 0.08,
  },

  // ---------- LUCES (intensidades base; el scroll las MODULA) ----------
  LIGHTS: {
    ambient: 0.18,
    keyColor: '#fff1da', // softbox cálida
    fillColor: '#cfe0ff', // softbox fría
    rimColor: '#ffffff', // contraluz (separa del fondo / translucidez)
  },

  // ---------- POSTPROCESADO (opcional) ----------
  POST: {
    enabled: true,
    // ⚠ Bloom OFF por defecto: se documentó Context Lost al combinar
    // bloom + shadow-maps en algunas GPUs.
    // Aquí NO usamos shadow-maps (solo ContactShadows), así que puedes activarlo
    // con cuidado. Se desactiva siempre en móvil.
    bloom: false,
    bloomIntensity: 0.55,
    bloomThreshold: 0.82,
    bloomRadius: 0.6,
    vignette: true, // viñeta sutil: barato y muy "premium". Seguro en todas las GPUs.
    vignetteDarkness: 0.9,
    vignetteOffset: 0.32,
  },

  // ---------- TEMA (premium oscuro con acentos de marca) ----------
  THEME: {
    accent: '#34d399', // verde marca (milpa)
    accentWarm: '#f59e0b', // ámbar maíz
    text: '#f4f2ea',
    textDim: 'rgba(244, 242, 234, 0.60)',
  },
};

// ---------- Helper: hex → componentes lineales 0..1 ----------
// Convertimos cada color de fondo de sección al espacio de trabajo LINEAL
// (ColorManagement está activo en r169). Tween-eamos estos escalares en el
// timeline y los aplicamos con scene.background.setRGB(...,LinearSRGBColorSpace).
export function hexToLinearRGB(hex) {
  const c = new THREE.Color(hex); // THREE interpreta el hex como sRGB → linear
  return { r: c.r, g: c.g, b: c.b };
}
