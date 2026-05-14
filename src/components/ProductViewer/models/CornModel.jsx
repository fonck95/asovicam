import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeHuskAlphaTexture,
  makeHuskColorTexture,
  makeHuskNormalTexture,
} from '../textures';

// =====================================================
// Maíz: mazorca con geometría 3D real para CADA grano.
// Antes los granos eran una textura 2D pintada sobre un
// LatheGeometry casi-liso (cilindro). Ahora cada grano
// es una malla 3D individual instanciada (InstancedMesh)
// montada sobre un cob core cremoso. El resultado tiene
// relieve volumétrico real — los granos proyectan sombra
// unos sobre otros, reaccionan al ángulo de cámara y dejan
// ver el olote entre filas. Hojas (husks) en la base
// (algunas pulled-back) y barbas (silk) por la punta.
// =====================================================

// Proporciones más realistas: mazorca esbelta (ratio length:diameter ≈ 3:1).
// Antes 1.7×0.96 (ratio 1.77:1) — demasiado ancha; ahora la diámetro real
// final con granos protruidos es ~0.62, dando un ratio visual ~2.8:1, en
// línea con el maíz fotográfico.
const COB_HEIGHT = 1.75;
// CORE_RADIUS = radio del olote (cob axis) donde se montan los granos.
// Es menor que el radio visible final porque cada grano protruye desde
// la superficie del core.
const CORE_RADIUS = 0.26;
// Densidad de granos: filas longitudinales × filas circunferenciales.
// 34 filas verticales (Fibonacci) × 18 columnas (par, encaja en el
// nuevo perímetro). El maíz real tiene siempre filas en cantidad par
// entre 12 y 22; 18 es típico para dent corn.
const KERNEL_ROWS = 34;
const KERNEL_COLS = 18;
// Tamaño base del grano (radio de la esfera fuente antes de deformar).
// Escalado proporcionalmente al CORE_RADIUS reducido para preservar
// la relación grano/olote.
const KERNEL_R = 0.044;

function cobProfileAt(t) {
  // Perfil de la mazorca como función de la altura normalizada t∈[0,1].
  // Base con ramp-up corto (donde se atornilla al tallo), sección media
  // casi cilíndrica con leve panza, hombro al ~82%, y después un DOMO
  // redondeado (cuarto de elipse) que termina la mazorca en una punta
  // suave — no en un cono ni en un disco plano. Es desde este domo,
  // como prolongación natural del propio olote, que emergen las barbas.
  // Antes el cob terminaba en un pico casi-cero y un casquete separado
  // se colocaba encima — el resultado era un efecto "hongo" del que
  // los silks parecían colgar. Ahora el domo ES la parte superior.
  // La MISMA función la usan el cob core (lathe) y el placement de
  // granos para que ambos coincidan en superficie.
  if (t < 0.10) {
    return 0.05 + Math.pow(t / 0.10, 0.65) * 0.89;
  } else if (t < 0.82) {
    const u = (t - 0.10) / 0.72;
    return 0.94 + Math.sin(u * Math.PI) * 0.045 - Math.cos(u * 2.3 * Math.PI) * 0.010;
  } else if (t < 0.94) {
    // Hombro: taper gradual desde el cuerpo hasta el comienzo del domo
    const u = (t - 0.82) / 0.12;
    return 0.95 - u * 0.40 + Math.sin(u * Math.PI) * 0.02;
  } else {
    // Domo apical: cuarto de elipse convexo. Pendiente horizontal al
    // empezar (hombro suave) y vertical al llegar al ápice (punta
    // redondeada). De aquí emergen los silks como continuación del
    // tejido del olote, no de un casquete pegado encima.
    const u = (t - 0.94) / 0.06;
    return 0.55 * Math.sqrt(Math.max(0, 1 - u * u));
  }
}

function profileSlopeAt(t) {
  // Derivada numérica del perfil — la usamos para inclinar los granos
  // de modo que descansen tangentes al cob core (no perpendiculares al
  // eje Y cuando la mazorca se afina).
  const h = 0.005;
  return (cobProfileAt(Math.min(1, t + h)) - cobProfileAt(Math.max(0, t - h))) / (2 * h);
}

function buildCobCoreGeometry() {
  // Núcleo blanco/cremoso del olote. Sobre éste se montan los granos
  // como mallas 3D individuales. Como el core queda mayormente cubierto,
  // basta un lathe simple — sólo se verá entre los huecos de granos.
  const points = [];
  const segs = 64;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    const profile = cobProfileAt(t);
    points.push(new THREE.Vector2(CORE_RADIUS * Math.max(0.03, profile), y));
  }
  const geo = new THREE.LatheGeometry(points, 80);
  geo.computeVertexNormals();
  return geo;
}

function buildKernelGeometry() {
  // Geometría base de UN grano de maíz. Forma de gota: espalda aplanada
  // (toca el cob), corona redondeada bulging hacia afuera, base más
  // estrecha (germen). Coordenadas locales:
  //   +X = afuera (radial), -X = pegado al cob
  //   +Y = arriba (corona), -Y = abajo (germen)
  //   ±Z = lateral (filas adyacentes)
  // Después del build, trasladamos para que la cara posterior quede
  // anclada en X=0 — así al posicionar el grano en (r·cosθ, y, r·sinθ)
  // la espalda toca exactamente la superficie del core de radio r.
  const geo = new THREE.SphereGeometry(KERNEL_R, 14, 10);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const backScale = 0.30;   // factor de aplastado de la espalda
  const frontScale = 1.08;  // factor de protrusión de la corona
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yNorm = v.y / KERNEL_R; // -1..1
    if (v.x < 0) {
      v.x *= backScale;
    } else {
      v.x *= frontScale;
    }
    // Estirar verticalmente — el grano es más alto que ancho
    v.y *= 1.32;
    // Taper hacia el germen
    const taper = yNorm < 0 ? 0.55 + (1 + yNorm) * 0.45 : 1.0;
    v.z *= taper;
    if (v.x > 0) v.x *= taper;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // Anclar la espalda en X=0
  const backOffset = KERNEL_R * backScale;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + backOffset);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildKernelInstanceData() {
  // Lista de transformaciones por grano. Para cada celda de la grilla
  // staggered (filas alternadas con offset 0.5 — patrón hexagonal real)
  // calculamos posición sobre la superficie del cob core, orientación
  // tangente al perfil del cob y color con variación de madurez.
  const items = [];
  const palette = [
    new THREE.Color('#fcd34d'),
    new THREE.Color('#fbbf24'),
    new THREE.Color('#f59e0b'),
    new THREE.Color('#fde68a'),
    new THREE.Color('#fef3c7'),
    new THREE.Color('#facc15'),
    new THREE.Color('#eab308'),
    new THREE.Color('#d4a843'),
  ];
  const paleColor = new THREE.Color('#fff5d6');
  const amberColor = new THREE.Color('#c98a35');

  // Twist helicoidal sutil sobre las filas: ~7° de rotación total a lo
  // largo de la mazorca. El maíz real tiene un leve giro filotáctico
  // en sus filas; añade variación orgánica sin convertir las hileras
  // rectas en espirales.
  const HELIX_TWIST_TOTAL = 0.12;

  for (let row = 0; row < KERNEL_ROWS; row++) {
    const t = (row + 0.5) / KERNEL_ROWS;
    // Bordes: dejamos un pequeño margen en la base, y en la punta los
    // granos terminan ANTES de entrar al domo apical (zona de pelos).
    if (t < 0.05 || t > 0.93) continue;
    const profile = cobProfileAt(t);
    const radius = CORE_RADIUS * Math.max(0.04, profile);
    if (radius < CORE_RADIUS * 0.32) continue;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    // Inclinación tangente al perfil del cob — los granos en la base/punta
    // se "acuestan" sobre la curva del olote en lugar de salir horizontales
    const slope = profileSlopeAt(t) * CORE_RADIUS;
    const tiltAngle = Math.atan2(-slope, COB_HEIGHT);

    const stagger = (row % 2) * 0.5;
    const helixOffset = t * HELIX_TWIST_TOTAL;

    for (let col = 0; col < KERNEL_COLS; col++) {
      const angle = ((col + stagger) / KERNEL_COLS) * Math.PI * 2 + helixOffset;

      // Hash determinístico per-grano para tamaño, color y subdesarrollo
      const h1raw = Math.abs(Math.sin(row * 12.9898 + col * 78.233) * 43758.5453);
      const h1 = h1raw - Math.floor(h1raw);
      const h2raw = Math.abs(Math.sin(row * 41.17 + col * 7.31) * 24631.7);
      const h2 = h2raw - Math.floor(h2raw);
      const h3raw = Math.abs(Math.sin(row * 5.37 + col * 19.4) * 17311.3);
      const h3 = h3raw - Math.floor(h3raw);

      // Hacia la punta perdemos granos (la mazorca real no llena la corona)
      if (t > 0.85) {
        const tipChance = (t - 0.85) / 0.08;
        if (h3 < tipChance * 0.75) continue;
      }
      // ~3% subdesarrollados (más pequeños, hundidos)
      const underdev = h1 < 0.03;

      // Tamaños: escala radial (profundidad), vertical, y arc-tangencial.
      // arcWidth = espaciado real entre granos adyacentes en la fila;
      // dividir entre KERNEL_R*1.9 deja un pequeño solape tangencial
      // — los granos en mazorca real se aprietan unos contra otros.
      const arcWidth = (2 * Math.PI * radius) / KERNEL_COLS;
      const scaleX = (0.88 + h1 * 0.22) * (underdev ? 0.50 : 1);
      const scaleY = (0.92 + h2 * 0.20) * (underdev ? 0.55 : 1);
      const scaleZ = (arcWidth / (KERNEL_R * 1.85)) * (0.94 + h2 * 0.12) * (underdev ? 0.55 : 1);

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Color: paleta amarilla/dorada + variación de madurez
      let baseColor = palette[Math.floor(h2 * palette.length)].clone();
      // ~8% ámbar maduro
      if (h1 > 0.92) baseColor = baseColor.clone().lerp(amberColor, 0.6);
      // Granos cerca de los extremos un poco más pálidos (lechosos)
      const edgeFade = Math.abs(t - 0.5) * 2;
      if (edgeFade > 0.55) {
        baseColor.lerp(paleColor, (edgeFade - 0.55) * 0.45);
      }

      items.push({
        x, y, z,
        angle,
        tiltAngle,
        scaleX,
        scaleY,
        scaleZ,
        color: baseColor,
      });
    }
  }
  return items;
}

// Radio del cilindro virtual sobre el que se enrollan las hojas.
// Apenas mayor que el envolvente de los granos (CORE_RADIUS + protrusión
// del grano ≈ 0.31). Las hojas pegadas viven justo encima de este cilindro
// y se traslapan unas con otras alrededor del eje del olote.
const HUSK_WRAP_RADIUS = 0.34;

function buildHuskGeometry({
  length = 1.55,
  arcExtent = 0.95,   // semi-arco angular que cubre la hoja (rad)
  peel = 0,
  baseY = -0.92,
  baseTipFlare = 0.0, // para hojas peeled: cuánto se abren hacia afuera en la punta
} = {}) {
  // Hoja envolvente centrada en el EJE del olote. A diferencia de la
  // versión anterior (que offset-eaba cada hoja en radio y dejaba
  // huecos entre vecinas), aquí cada hoja se construye con su origen
  // local en el axis y simplemente cubre un sector angular del
  // cilindro virtual de radio HUSK_WRAP_RADIUS. Posicionar 8–10 hojas
  // con rotaciones Y distintas crea capas que se traslapan de forma
  // continua, igual que las brácteas reales del maíz.
  const lengthSegs = 36;
  const widthSegs = 16;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const y = baseY + t * length;
    // Ancho efectivo según t: pegada-ancha en la base, taper progresivo,
    // termina en punta acuminada en t=1 (forma de bráctea real).
    const taper =
      Math.sin(Math.pow(t, 0.78) * Math.PI) * 0.85 +
      0.18 -
      Math.max(0, (t - 0.90) * 4) ** 2 * 0.42;
    const widthScale = Math.max(0.05, taper);

    // Despliegue hacia afuera (peel): la hoja se separa progresivamente
    // del cilindro a medida que sube. peel=0 → siempre pegada;
    // peel=1 → al llegar a la punta está totalmente expuesta y fan-out.
    const fanOut = peel * Math.pow(t, 1.25);
    const radius = HUSK_WRAP_RADIUS + fanOut * 0.22;
    // En la punta de las hojas pulled-back agregamos un flare lateral
    // para que el final caiga hacia afuera en lugar de quedar recto.
    const tipFlare = baseTipFlare * Math.pow(t, 2.2);

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const uRel = (u - 0.5) * 2; // -1..+1
      const ang = uRel * arcExtent * widthScale;
      // Punto sobre el cilindro virtual a este ángulo. Local frame:
      //   +X = lateral derecha en el sector cubierto
      //   +Y = arriba (a lo largo del olote)
      //   +Z = al frente, alejándose del cilindro (se usa para "salir"
      //       en hojas peeled o para la nervadura central)
      const sx = Math.sin(ang) * radius;
      const sz = -Math.cos(ang) * radius;
      // Nervadura central: cresta a lo largo de u=0.5 que sobresale
      // ligeramente hacia afuera (en dirección -Z local del cilindro).
      const rib = (1 - Math.abs(uRel)) * 0.022 * (1 - fanOut * 0.4);
      // Onda lateral baja-frecuencia para no parecer plana.
      const wave = Math.sin(t * 4.6 + uRel * 2.3) * 0.014 * (1 - peel * 0.45);
      // Curl hacia afuera de las puntas peeled (sólo afecta hojas con peel>0)
      const peelLift = peel > 0
        ? (-fanOut * 0.25 * (1 - Math.abs(uRel) * 0.4))
        : 0;
      // Flare lateral en la punta de hojas peeled — las orillas se
      // separan más que el centro al final.
      const flare = tipFlare * Math.sign(uRel) * Math.abs(uRel);

      const x = sx + Math.sin(ang) * rib + flare * 0.18;
      const z = sz - Math.cos(ang) * rib + peelLift;
      positions.push(x, y + wave * 0.6, z);
      uvs.push(u, t);
    }
  }

  const cols = widthSegs + 1;
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < widthSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildHuskCollarGeometry() {
  // Anillo "cuello" en la base de la mazorca donde todas las hojas
  // se unen visualmente. Sin este collar, la base se ve dividida en
  // hojas sueltas pegadas a la nada. Un toro aplanado provee la
  // continuidad de tejido que conecta las brácteas con el pedúnculo.
  const segs = 96;
  const tubeSegs = 14;
  const ringR = HUSK_WRAP_RADIUS + 0.004;
  const tubeR = 0.060;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const a = u * Math.PI * 2;
    for (let j = 0; j <= tubeSegs; j++) {
      const v = j / tubeSegs;
      const theta = -Math.PI * 0.5 + v * Math.PI; // -π/2..π/2 (medio toro inferior abierto)
      const r = ringR + Math.cos(theta) * tubeR * 0.9;
      const y = Math.sin(theta) * tubeR * 1.2;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(u, v);
    }
  }
  const cols = tubeSegs + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < tubeSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildSilkGeometry() {
  // Mecha de barbas (silk / pelos de elote). Rediseñada para que el
  // tuft sea CONTINUACIÓN del propio olote, no un objeto pegado encima:
  // 1) Las raíces de las hebras se entierran dentro del DOMO apical
  //    del cob (cobProfileAt para t > 0.94). El material opaco del
  //    olote oculta la raíz y la hebra emerge atravesando la superficie
  //    del domo. Antes había un casquete (silkBaseGeometry) plantado
  //    sobre la mazorca como si fuera un hongo — eliminado.
  // 2) Los clusters se distribuyen en ESPIRAL DE FERMAT con incrementos
  //    de ángulo áureo (~137.5°). Ésta es la filotaxis natural de los
  //    estigmas reales: en el ápice de la inflorescencia los puntos de
  //    inserción siguen el mismo patrón que los semillas de girasol.
  //    r = √(c/C_max) × R_max distribuye los puntos uniformemente sin
  //    los anillos concéntricos artificiales del muestreo polar normal.
  // 3) Hebras agrupadas dentro de cada cluster con dispersión angular
  //    pequeña (~3°) para que dentro de cada grupo viajen casi paralelas
  //    — patrón real de los estigmas que comparten un mismo carpelo.
  // 4) Trayectoria dominada por cascada vertical (droop) con apertura
  //    radial moderada: el tuft cae como una cabellera, no explota
  //    en abanico.
  // 5) Color base verdoso → cobre → rubio claro al extremo.
  const strands = [];
  const colorRoot = new THREE.Color('#bfa874');  // base verdoso-tostada
  const colorMid = new THREE.Color('#d6b27a');   // cobre cálido
  const colorTip = new THREE.Color('#f3dba0');   // rubio claro

  // 21 clusters y 8 hebras/cluster — ambos números de Fibonacci.
  // Total = 168 hebras: suficiente densidad para un manojo cohesivo
  // sin saturar el ápice.
  const CLUSTERS = 21;
  const STRANDS_PER_CLUSTER = 8;
  // Ángulo dorado en radianes (≈ 137.5°). Patrón filotáctico del
  // ápice de la inflorescencia del maíz.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  // Radio máximo del PUNTO DE ANCLAJE de un cluster. El domo a la
  // altura del anclaje tiene radio (CORE_RADIUS × profile) ≈ 0.13,
  // así que con MAX_ANCHOR_R = 0.075 las raíces quedan ESTRICTAMENTE
  // dentro del volumen opaco del olote.
  const MAX_ANCHOR_R = 0.075;
  // Altura del anclaje: dentro del domo apical, ligeramente bajo la
  // superficie. La raíz queda oculta y la hebra sale por la
  // intersección con la malla del olote.
  const APEX_Y = COB_HEIGHT / 2 - 0.06;

  let strandIdx = 0;
  for (let c = 0; c < CLUSTERS; c++) {
    // Espiral de Fermat: ángulo áureo por cluster, radio ∝ √c.
    // Esto da una distribución uniforme y orgánica sin anillos.
    const radialNorm = Math.sqrt(c / Math.max(1, CLUSTERS - 1));
    const baseAngle = c * GOLDEN_ANGLE + (Math.random() - 0.5) * 0.04;
    const baseR = radialNorm * MAX_ANCHOR_R;
    // El anclaje desciende ligeramente con el radio: el domo se
    // curva hacia abajo, y enterramos los anclajes externos un
    // poco más para que sigan la curvatura del tejido.
    const baseY = APEX_Y - radialNorm * 0.030 + (Math.random() - 0.5) * 0.012;

    for (let s = 0; s < STRANDS_PER_CLUSTER; s++) {
      strandIdx++;
      // Dispersión angular interna ~±3° — el cluster luce como una
      // pequeña mecha cohesiva, no como rayos divergentes.
      const localScatter = (Math.random() - 0.5) * 0.06;
      const angle = baseAngle + localScatter;
      // Longitudes con menos variación que antes (sin stubby muy cortas
      // que rompían la unidad del tuft). La mayoría medianas-largas.
      let length;
      const lengthRand = Math.random();
      if (lengthRand < 0.18) length = 0.32 + Math.random() * 0.16;       // semi-corta
      else if (lengthRand < 0.78) length = 0.55 + Math.random() * 0.28;  // mid
      else length = 0.85 + Math.random() * 0.30;                          // larga

      const droop = 0.45 + Math.random() * 0.35;
      const sway = (Math.random() - 0.5) * 0.10;
      const radialJit = (Math.random() - 0.5) * 0.012;
      const startR = baseR + radialJit;

      // Apertura radial reducida: el tuft cae más que abre.
      // Antes: tip radial = startR + 0.18 + droop·0.42 (≈ startR+0.35)
      // Ahora: tip radial = startR + 0.07 + droop·0.20 (≈ startR+0.16)
      const start = new THREE.Vector3(
        Math.cos(angle) * startR,
        baseY,
        Math.sin(angle) * startR,
      );
      const neck = new THREE.Vector3(
        Math.cos(angle) * (startR + 0.010 + length * 0.04),
        baseY + length * 0.28,
        Math.sin(angle) * (startR + 0.010 + length * 0.04),
      );
      const mid = new THREE.Vector3(
        Math.cos(angle) * (startR + 0.035 + droop * 0.10) + sway * 0.30,
        baseY + length * 0.65,
        Math.sin(angle) * (startR + 0.035 + droop * 0.10) + sway * 0.30,
      );
      const tip = new THREE.Vector3(
        Math.cos(angle) * (startR + 0.070 + droop * 0.20) + sway * 0.65,
        baseY + length - droop * 0.28,
        Math.sin(angle) * (startR + 0.070 + droop * 0.20) + sway * 0.65,
      );
      const curve = new THREE.CatmullRomCurve3([start, neck, mid, tip]);
      const tubularSegments = 14;
      const radialSegments = 4;
      const tube = new THREE.TubeGeometry(
        curve,
        tubularSegments,
        0.0034,
        radialSegments,
        false,
      );

      // Taper sobre los anillos del tubo: empieza más grueso en la raíz
      // (donde se "ancla" al casquete), termina filiforme en la punta.
      const tp = tube.attributes.position;
      const verts = tp.count;
      const ringSize = verts / (tubularSegments + 1);
      for (let r = 0; r <= tubularSegments; r++) {
        const t = r / tubularSegments;
        // Anillo de raíz un poco más ancho para que se vea anclado,
        // luego rápido taper.
        const rootBulge = t < 0.08 ? 1 + (0.08 - t) * 4.5 : 1;
        const taper = Math.max(0.30, Math.pow(1 - t, 0.55)) * rootBulge;
        const center = curve.getPoint(t);
        const ringStart = Math.floor(r * ringSize);
        const ringEnd = Math.floor((r + 1) * ringSize);
        for (let k = ringStart; k < ringEnd && k < verts; k++) {
          const px = tp.getX(k);
          const py = tp.getY(k);
          const pz = tp.getZ(k);
          const dx = px - center.x;
          const dy = py - center.y;
          const dz = pz - center.z;
          tp.setXYZ(
            k,
            center.x + dx * taper,
            center.y + dy * taper,
            center.z + dz * taper,
          );
        }
      }
      tp.needsUpdate = true;
      tube.computeVertexNormals();

      const tubeColors = new Float32Array(verts * 3);
      const tmp = new THREE.Color();
      const tmp2 = new THREE.Color();
      for (let r = 0; r <= tubularSegments; r++) {
        const t = r / tubularSegments;
        // Gradiente 3-stop: root → mid → tip con curva suave.
        if (t < 0.5) {
          tmp.copy(colorRoot).lerp(colorMid, t * 2);
        } else {
          tmp.copy(colorMid).lerp(colorTip, (t - 0.5) * 2);
        }
        // Variación por hebra individual
        const hueShift = (strandIdx * 17 % 13) / 13 - 0.5;
        tmp2.setRGB(
          Math.min(1, tmp.r + hueShift * 0.04),
          Math.min(1, tmp.g + hueShift * 0.02),
          Math.min(1, tmp.b - hueShift * 0.06),
        );
        const ringStart = Math.floor(r * ringSize);
        const ringEnd = Math.floor((r + 1) * ringSize);
        for (let k = ringStart; k < ringEnd && k < verts; k++) {
          tubeColors[k * 3 + 0] = tmp2.r;
          tubeColors[k * 3 + 1] = tmp2.g;
          tubeColors[k * 3 + 2] = tmp2.b;
        }
      }
      tube.setAttribute('color', new THREE.BufferAttribute(tubeColors, 3));
      strands.push(tube);
    }
  }
  return mergeBufferGeometries(strands);
}

function mergeBufferGeometries(geos) {
  // Implementación mínima sin depender de BufferGeometryUtils.
  // Soporta position + normal + (opcional) color.
  let totalVerts = 0;
  let totalIdx = 0;
  let hasColor = false;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
    if (g.attributes.color) hasColor = true;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = hasColor ? new Float32Array(totalVerts * 3) : null;
  const indices = new Uint32Array(totalIdx);
  let pOff = 0, nOff = 0, cOff = 0, iOff = 0, vBase = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    positions.set(p, pOff);
    normals.set(n, nOff);
    pOff += p.length; nOff += n.length;
    if (colors) {
      if (g.attributes.color) {
        colors.set(g.attributes.color.array, cOff);
      } else {
        colors.fill(1, cOff, cOff + p.length);
      }
      cOff += p.length;
    }
    if (g.index) {
      const idx = g.index.array;
      for (let k = 0; k < idx.length; k++) indices[iOff + k] = idx[k] + vBase;
      iOff += idx.length;
    }
    vBase += g.attributes.position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (colors) {
    merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

export default function CornModel() {
  const groupRef = useRef(null);
  const kernelMeshRef = useRef(null);

  const cobCoreGeometry = useMemo(buildCobCoreGeometry, []);
  const kernelGeometry = useMemo(buildKernelGeometry, []);
  const kernelInstances = useMemo(buildKernelInstanceData, []);
  const silkGeometry = useMemo(buildSilkGeometry, []);

  // Distribución filotáctica de las brácteas (hojas envolventes).
  // Configuración de SEMI-COBERTURA estilo MARKETING: en vez de envolver
  // completamente la mazorca (que tapaba la mayoría de los granos), la
  // mayoría de las hojas están peeled-back y fanned-out alrededor del
  // olote — como en empaques de elote dulce o fotografía de producto.
  //  • 7 base wraps cortos que sólo cubren el cuarto inferior del olote
  //    (anclan la mazorca al pedúnculo sin obstruir los granos).
  //  • 7 hojas peeled-back largas que se abren en bouquet alrededor de
  //    la mazorca, dejando expuesta la mayor parte de los granos.
  // El ángulo de inserción usa el ÁNGULO ÁUREO (~137.5°) — la misma
  // filotaxis natural de las gramíneas; conteos en Fibonacci (7+7=14).
  // La variación de longitud, arco y baseY se deriva de la fase i/φ
  // para que la irregularidad sea matemáticamente coherente con la
  // distribución angular (no random ruidoso).
  const huskConfig = useMemo(
    () => {
      const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
      const PHI = (1 + Math.sqrt(5)) / 2;
      const wrapping = [];

      // === Base wraps: hojas cortas en el pedúnculo ===
      // Largo 0.52-0.72 sobre un cob de 1.75 → cubren sólo el tercio
      // inferior. Capas alternadas (0-1) para dar grosor a la base.
      const BASE_WRAP_COUNT = 7;
      for (let i = 0; i < BASE_WRAP_COUNT; i++) {
        const phase = (i / PHI) - Math.floor(i / PHI);
        const layer = i % 3 === 2 ? 1 : 0;
        wrapping.push({
          peel: 0.04 + (i % 2) * 0.03,
          length: 0.52 + phase * 0.22,
          arcExtent: 0.86 + (1 - phase) * 0.14,
          angleOffset: i * GOLDEN_ANGLE,
          layer,
          baseY: -0.94 + phase * 0.04,
          baseTipFlare: 0,
        });
      }

      // === Hojas peeled-back: el "bouquet" de marketing ===
      // 7 hojas largas (1.10-1.40) que emergen alrededor de la base
      // del olote y se abren hacia afuera. peel 0.72-0.92 garantiza
      // que se separen claramente del cob; baseY se reparte entre
      // -0.66 y -0.50 para que las puntas terminen a alturas variadas
      // (cascada orgánica, no abanico uniforme).
      const PEEL_COUNT = 7;
      const PEEL_ANGLE_OFFSET = 0.42; // descorrelaciona con base wraps
      for (let i = 0; i < PEEL_COUNT; i++) {
        const phase = ((i + 0.5) / PHI) - Math.floor((i + 0.5) / PHI);
        wrapping.push({
          peel: 0.72 + phase * 0.20,
          length: 1.10 + phase * 0.30,
          arcExtent: 0.74 + (1 - phase) * 0.16,
          angleOffset: PEEL_ANGLE_OFFSET + i * GOLDEN_ANGLE,
          layer: 2,
          baseY: -0.66 + phase * 0.16,
          baseTipFlare: 0.22 + phase * 0.18,
        });
      }
      return wrapping;
    },
    [],
  );
  const huskGeometries = useMemo(
    () => huskConfig.map((cfg) => buildHuskGeometry({
      length: cfg.length,
      arcExtent: cfg.arcExtent,
      peel: cfg.peel,
      baseY: cfg.baseY,
      baseTipFlare: cfg.baseTipFlare,
    })),
    [huskConfig],
  );
  const huskCollarGeometry = useMemo(buildHuskCollarGeometry, []);

  const huskColor = useMemo(makeHuskColorTexture, []);
  const huskNormal = useMemo(makeHuskNormalTexture, []);
  const huskAlpha = useMemo(makeHuskAlphaTexture, []);

  // Aplicamos las matrices y colores de cada instancia tras montar el
  // InstancedMesh. Cada grano se compone como: trasladar a la posición
  // sobre el cob → girar en Y para que +X mire radialmente afuera → tilt
  // alrededor de la tangente para acostarse en el perfil curvado → escalar.
  useLayoutEffect(() => {
    const mesh = kernelMeshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const tBase = new THREE.Matrix4();
    const rY = new THREE.Matrix4();
    const rTilt = new THREE.Matrix4();
    const sM = new THREE.Matrix4();
    for (let i = 0; i < kernelInstances.length; i++) {
      const item = kernelInstances[i];
      // 1) Escala local en el grano (depth, height, tangential width)
      sM.makeScale(item.scaleX, item.scaleY, item.scaleZ);
      // 2) Tilt sobre el eje Z local (gira en plano X-Y) — acuesta el
      //    grano para que su +X se incline con el perfil del cob
      rTilt.makeRotationZ(item.tiltAngle);
      // 3) Yaw en Y para apuntar el +X radialmente afuera en el ángulo θ
      rY.makeRotationY(-item.angle);
      // 4) Trasladar al punto de la superficie del cob core
      tBase.makeTranslation(item.x, item.y, item.z);
      // Compose: T · Ry · Rt · S
      m.multiplyMatrices(tBase, rY);
      m.multiply(rTilt);
      m.multiply(sM);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, item.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [kernelInstances]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.02;
  });

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}>
      {/* Cob core (olote) — eje cremoso visible entre las filas de granos */}
      <mesh geometry={cobCoreGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#efe0b4"
          roughness={0.78}
          metalness={0}
          sheen={0.18}
          sheenColor="#fff5dc"
          sheenRoughness={0.6}
          clearcoat={0.15}
          clearcoatRoughness={0.55}
        />
      </mesh>

      {/* Granos: cada uno es una malla 3D real (no textura) instanciada.
          El color base lo aporta cada instancia vía setColorAt. */}
      <instancedMesh
        ref={kernelMeshRef}
        args={[kernelGeometry, undefined, kernelInstances.length]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.40}
          metalness={0.02}
          clearcoat={0.85}
          clearcoatRoughness={0.18}
          envMapIntensity={1.25}
          sheen={0.30}
          sheenColor="#fef3c7"
          sheenRoughness={0.55}
          transmission={0.06}
          thickness={0.12}
          attenuationColor="#fbbf24"
          attenuationDistance={0.4}
          ior={1.42}
        />
      </instancedMesh>

      {/* Barbas (silk) en la punta — emergen DESDE DENTRO del domo
          apical del propio olote (cobProfileAt en t > 0.94). El
          tejido opaco del cob oculta las raíces y las hebras se
          asoman atravesando la superficie del domo como prolongación
          natural del olote — NO desde un casquete separado encima.
          Esto elimina el efecto "hongo" donde los silks parecían
          colgar de una plataforma. */}
      <mesh geometry={silkGeometry} castShadow={false}>
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.35}
          metalness={0}
          sheen={1}
          sheenColor="#fff0c8"
          sheenRoughness={0.22}
          transmission={0.6}
          thickness={0.04}
          ior={1.36}
          attenuationColor="#e8c89a"
          attenuationDistance={0.25}
          clearcoat={0.25}
          clearcoatRoughness={0.4}
          envMapIntensity={1.1}
          vertexColors
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cuello / collar de la base: aro de tejido que conecta todas
          las hojas con el pedúnculo. Sin esta unión visual, la base de
          la mazorca se ve como un manojo de hojas sueltas pegadas al
          aire. Color un poco más cremoso que las hojas para imitar
          la transición pedúnculo → bráctea joven en la base. */}
      <mesh
        geometry={huskCollarGeometry}
        position={[0, -COB_HEIGHT * 0.50, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#a8a36a"
          roughness={0.85}
          metalness={0}
          sheen={0.4}
          sheenColor="#cbd5b1"
          sheenRoughness={0.6}
          clearcoat={0.1}
          clearcoatRoughness={0.7}
        />
      </mesh>

      {/* Hojas (husks) — cada una se construye centrada en el eje del
          olote y se ubica en (0, baseY, 0) con una rotación Y. Como
          todas comparten el mismo cilindro virtual (HUSK_WRAP_RADIUS),
          se traslapan continuamente unas con otras sin huecos. Las
          peeled-back además se inclinan hacia afuera para revelar los
          granos del extremo superior. */}
      {huskConfig.map((cfg, i) => {
        const peeled = cfg.peel > 0.4;
        // Capas: outer (layer 0) en el radio mayor, inner (layer 1) más
        // adentro, peeled (layer 2) salen alrededor de la base y caen
        // hacia afuera formando el bouquet de marketing.
        const radialPush = cfg.layer === 1 ? -0.02 : 0;
        // Tilt para peeled aumentado a ~0.78 rad (45°): las hojas se
        // abren francamente hacia afuera revelando los granos. Las
        // pegadas mantienen una inclinación mínima hacia el cob.
        const tiltX = peeled ? 0.78 : -0.02 + (i % 2) * 0.015;
        const tiltZ = peeled ? (i % 2 === 0 ? 0.16 : -0.16) : 0;
        return (
          <mesh
            key={i}
            geometry={huskGeometries[i]}
            position={[0, 0, radialPush]}
            rotation={[tiltX, cfg.angleOffset, tiltZ]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              map={huskColor}
              normalMap={huskNormal}
              normalScale={[1.1, 1.1]}
              alphaMap={huskAlpha}
              alphaTest={0.42}
              roughness={0.78}
              metalness={0}
              sheen={0.5}
              sheenColor="#cbd5b1"
              sheenRoughness={0.55}
              clearcoat={0.18}
              clearcoatRoughness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}
