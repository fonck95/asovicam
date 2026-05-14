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

const COB_HEIGHT = 1.7;
// CORE_RADIUS = radio del olote (cob axis) donde se montan los granos.
// Es menor que el radio visible final porque cada grano protruye desde
// la superficie del core.
const CORE_RADIUS = 0.38;
// Densidad de granos: filas longitudinales × filas circunferenciales.
// Real corn tiene 14-22 longitudinal rows; usamos 22 para densidad
// visual estética. 28 ranks verticales para una mazorca alargada.
const KERNEL_ROWS = 28;
const KERNEL_COLS = 22;
// Tamaño base del grano (radio de la esfera fuente antes de deformar)
const KERNEL_R = 0.058;

function cobProfileAt(t) {
  // Perfil de la mazorca como función de la altura normalizada t∈[0,1].
  // Base con ramp-up corto (donde se atornilla al tallo), sección media
  // casi cilíndrica con leve panza, hombro al ~78%, después taper hasta
  // una punta redondeada. La MISMA función la usan el cob core (lathe)
  // y el placement de granos para que ambos coincidan en superficie.
  if (t < 0.10) {
    return 0.05 + Math.pow(t / 0.10, 0.65) * 0.89;
  } else if (t < 0.78) {
    const u = (t - 0.10) / 0.68;
    return 0.94 + Math.sin(u * Math.PI) * 0.045 - Math.cos(u * 2.3 * Math.PI) * 0.010;
  } else {
    const u = (t - 0.78) / 0.22;
    return 0.95 * Math.pow(1 - u, 1.55) + 0.05 * (1 - u * u);
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

  for (let row = 0; row < KERNEL_ROWS; row++) {
    const t = (row + 0.5) / KERNEL_ROWS;
    // Bordes: dejamos un pequeño margen en base y punta donde el cob
    // se cierra (allí no caben granos)
    if (t < 0.05 || t > 0.95) continue;
    const profile = cobProfileAt(t);
    const radius = CORE_RADIUS * Math.max(0.04, profile);
    if (radius < CORE_RADIUS * 0.30) continue;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    // Inclinación tangente al perfil del cob — los granos en la base/punta
    // se "acuestan" sobre la curva del olote en lugar de salir horizontales
    const slope = profileSlopeAt(t) * CORE_RADIUS;
    const tiltAngle = Math.atan2(-slope, COB_HEIGHT);

    const stagger = (row % 2) * 0.5;

    for (let col = 0; col < KERNEL_COLS; col++) {
      const angle = ((col + stagger) / KERNEL_COLS) * Math.PI * 2;

      // Hash determinístico per-grano para tamaño, color y subdesarrollo
      const h1raw = Math.abs(Math.sin(row * 12.9898 + col * 78.233) * 43758.5453);
      const h1 = h1raw - Math.floor(h1raw);
      const h2raw = Math.abs(Math.sin(row * 41.17 + col * 7.31) * 24631.7);
      const h2 = h2raw - Math.floor(h2raw);
      const h3raw = Math.abs(Math.sin(row * 5.37 + col * 19.4) * 17311.3);
      const h3 = h3raw - Math.floor(h3raw);

      // Hacia la punta perdemos granos (la mazorca real no llena la corona)
      if (t > 0.82) {
        const tipChance = (t - 0.82) / 0.13;
        if (h3 < tipChance * 0.70) continue;
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

function buildHuskGeometry({ length = 1.55, width = 0.45, peel = 0 } = {}) {
  // Hoja con curva. peel = 0..1 controla qué tanto se "abre" la hoja
  // hacia afuera (0 = pegada, 1 = pulled-back). La hoja "pegada" se
  // envuelve cilíndricamente alrededor de la mazorca (los bordes
  // laterales se acercan al eje del olote); la hoja peelada se
  // despliega plana hacia afuera.
  const lengthSegs = 28;
  const widthSegs = 10;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Radio aproximado del cuerpo que la hoja envuelve (granos + olote).
  // Las hojas pegadas envuelven tangencialmente este cilindro.
  const WRAP_RADIUS = 0.48;
  const wrapStrength = 1 - peel;

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const y = -length * 0.05 + t * length;
    const taper =
      Math.sin(Math.pow(t, 0.85) * Math.PI) * 0.85 +
      0.15 -
      Math.max(0, (t - 0.92) * 4) ** 2 * 0.45;

    // Despliegue hacia afuera de la hoja (curl forward): mínimo en
    // hojas pegadas, dominante en hojas peeled-back.
    const peelCurve = peel * Math.pow(t, 1.5) * 0.62;
    const baseForward = (Math.sin(t * Math.PI * 0.7) * 0.04 + Math.pow(t, 2) * 0.05) * (0.3 + peel * 0.7);
    const curlZ = baseForward + peelCurve;

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const xRaw = (u - 0.5) * 2;
      const w = width * Math.max(0.04, taper);
      // Wrap cilíndrico: los bordes laterales (|xRaw|=1) se curvan hacia
      // el eje del olote. La hoja peeled se mantiene casi plana.
      const wrapAngle = xRaw * (w / WRAP_RADIUS) * wrapStrength;
      const x = wrapStrength > 0.05
        ? WRAP_RADIUS * Math.sin(wrapAngle) + xRaw * w * (1 - wrapStrength)
        : xRaw * w;
      const wrapZ = wrapStrength > 0.05
        ? -WRAP_RADIUS * (1 - Math.cos(wrapAngle))
        : 0;
      const rib = (1 - Math.abs(xRaw)) * 0.04;
      // Pequeña ondulación lateral para no parecer plana
      const lateralWave = Math.sin(t * 6 + xRaw * 2) * 0.010 * (1 - peel * 0.4);
      positions.push(x, y, curlZ + wrapZ + rib + lateralWave);
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

function buildSilkGeometry() {
  // Mecha de barbas (silk / pelos de elote). Cada hebra es un tubo con
  // 4 control points (start, neck, mid, tip) → curva orgánica con drop
  // natural. Radio decreciente (taper) y gradiente cobrizo→rubio claro.
  // Las hebras emergen desde la punta del olote y forman un mechón
  // cohesivo (no fuegos artificiales): la mayoría sube ligeramente
  // hacia adelante y cae con gravedad natural.
  const strands = [];
  const colorBase = new THREE.Color('#d4a574');
  const colorTip = new THREE.Color('#f0d5a0');
  const STRANDS = 170;
  for (let i = 0; i < STRANDS; i++) {
    const angle = (i / STRANDS) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const droop = 0.18 + Math.random() * 0.32;
    const sway = (Math.random() - 0.5) * 0.18;
    const length = 0.55 + Math.random() * 0.35;
    // Emerge desde la zona del olote justo arriba del último anillo de
    // granos — los pelos parecen brotar desde el cuerpo de la mazorca,
    // no desde un punto invisible.
    const emerge = 0.045 + Math.random() * 0.055;

    const start = new THREE.Vector3(
      Math.cos(angle) * emerge,
      COB_HEIGHT / 2 - 0.06 + Math.random() * 0.04,
      Math.sin(angle) * emerge,
    );
    const neck = new THREE.Vector3(
      Math.cos(angle) * (emerge + 0.02),
      COB_HEIGHT / 2 + length * 0.22,
      Math.sin(angle) * (emerge + 0.02),
    );
    const mid = new THREE.Vector3(
      Math.cos(angle) * (0.05 + droop * 0.16) + sway * 0.4,
      COB_HEIGHT / 2 + length * 0.62,
      Math.sin(angle) * (0.05 + droop * 0.16) + sway * 0.4,
    );
    const tip = new THREE.Vector3(
      Math.cos(angle) * (0.10 + droop * 0.38) + sway * 0.9,
      COB_HEIGHT / 2 + length - droop * 0.18,
      Math.sin(angle) * (0.10 + droop * 0.38) + sway * 0.9,
    );
    const curve = new THREE.CatmullRomCurve3([start, neck, mid, tip]);
    const tubularSegments = 16;
    const radialSegments = 4;
    const tube = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      0.0030,
      radialSegments,
      false,
    );

    // Taper a mano sobre los anillos del tubo
    const tp = tube.attributes.position;
    const verts = tp.count;
    const ringsCount = tubularSegments + 1;
    const ringSize = verts / ringsCount;
    for (let r = 0; r <= tubularSegments; r++) {
      const t = r / tubularSegments;
      const taper = Math.max(0.35, Math.pow(1 - t, 0.55));
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
    for (let r = 0; r <= tubularSegments; r++) {
      const t = r / tubularSegments;
      tmp.copy(colorBase).lerp(colorTip, t);
      const ringStart = Math.floor(r * ringSize);
      const ringEnd = Math.floor((r + 1) * ringSize);
      for (let k = ringStart; k < ringEnd && k < verts; k++) {
        tubeColors[k * 3 + 0] = tmp.r;
        tubeColors[k * 3 + 1] = tmp.g;
        tubeColors[k * 3 + 2] = tmp.b;
      }
    }
    tube.setAttribute('color', new THREE.BufferAttribute(tubeColors, 3));
    strands.push(tube);
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

  // 8 hojas: 6 pegadas (wrap alrededor de la base/centro) + 2 peeled-back
  // (revelan los granos). Más hojas = mejor cobertura tangencial sin
  // huecos visibles entre ellas.
  const huskConfig = useMemo(
    () => [
      { peel: 0.05, length: 1.55, width: 0.44 },
      { peel: 0.08, length: 1.5, width: 0.42 },
      { peel: 0.06, length: 1.55, width: 0.46 },
      { peel: 0.10, length: 1.48, width: 0.44 },
      { peel: 0.07, length: 1.52, width: 0.45 },
      { peel: 0.09, length: 1.5, width: 0.43 },
      { peel: 0.78, length: 1.42, width: 0.48 },
      { peel: 0.65, length: 1.36, width: 0.42 },
    ],
    [],
  );
  const huskGeometries = useMemo(
    () => huskConfig.map((cfg) => buildHuskGeometry(cfg)),
    [huskConfig],
  );

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

      {/* Barbas (silk) en la punta */}
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

      {/* Hojas (husks) ancladas al ras de la base de la mazorca, justo
          por fuera del envolvente de granos (KERNEL surface ≈ 0.44).
          Las pegadas envuelven el cilindro de granos vía wrapZ en la
          geometría; las peeled-back se inclinan hacia afuera con tilt
          negativo y se separan del cuerpo. */}
      {huskConfig.map((cfg, i) => {
        const angle = (i / huskConfig.length) * Math.PI * 2 + 0.2;
        const peeled = cfg.peel > 0.4;
        const huskRadius = peeled ? 0.46 : 0.50;
        // Pegadas: leve tilt hacia el eje (negativo) para abrazar el
        // contorno. Peeled: tilt positivo (se inclinan hacia afuera).
        const tilt = peeled ? 0.35 + (i % 2) * 0.06 : -0.04 + (i % 2) * 0.02;
        const scale = 1 + (i % 2) * 0.06;
        return (
          <mesh
            key={i}
            geometry={huskGeometries[i]}
            position={[
              Math.cos(angle) * huskRadius,
              -COB_HEIGHT * 0.50,
              Math.sin(angle) * huskRadius,
            ]}
            rotation={[tilt, Math.PI / 2 - angle, 0]}
            scale={scale}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              map={huskColor}
              normalMap={huskNormal}
              normalScale={[1.1, 1.1]}
              alphaMap={huskAlpha}
              alphaTest={0.5}
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
