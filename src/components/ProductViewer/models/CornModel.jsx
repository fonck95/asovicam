import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeCornColorTexture,
  makeCornNormalTexture,
  makeCornRoughnessTexture,
  makeHuskColorTexture,
  makeHuskNormalTexture,
} from '../textures';

// =====================================================
// Maíz: mazorca lathe + textura procedural detallada de
// granos (color + normal + roughness). Hojas (husks)
// envolventes en la base — algunas pulled-back para
// revelar los granos. Barbas (silk) saliendo por la punta.
// =====================================================

const COB_HEIGHT = 1.85;
const COB_RADIUS = 0.43;

function buildCobGeometry() {
  const points = [];
  const segs = 128;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    // Perfil de una mazorca real: predominantemente CILÍNDRICA (no
    // oval/limón). La base entra con un hombro ancho y un anillo de
    // granos pequeños donde se atornilla al tallo. La sección media es
    // casi recta — sólo con ligerísimas variaciones de grosor (rara vez
    // tan oval como un huevo). La punta se cierra con un cono asimétrico
    // y un pequeño nub redondeado al final.
    let profile;
    if (t < 0.07) {
      // Tope (base) muy estrecho — donde se rompe el cabo del tallo
      const u = t / 0.07;
      profile = 0.18 + Math.pow(u, 0.55) * 0.72;
    } else if (t < 0.16) {
      // Hombro corto, rápido ensanchamiento hasta el diámetro nominal
      const u = (t - 0.07) / 0.09;
      profile = 0.90 + Math.sin(u * Math.PI * 0.5) * 0.08;
    } else if (t < 0.78) {
      // Cuerpo: predominantemente CILÍNDRICO. La panza es muy leve y
      // está descentrada (~38% del cuerpo, no en el medio) — esto es
      // crítico para romper la simetría "huevo/limón".
      const u = (t - 0.16) / 0.62;
      const bellyShift = u - 0.38;
      // panza muy suave en lugar de un sin(πu) (que hace forma de huevo)
      profile = 0.98 - bellyShift * bellyShift * 0.085;
      // Pequeñas variaciones de grosor a lo largo (no un sin puro)
      profile += Math.sin(u * 5.3 + 1.7) * 0.013
               - Math.cos(u * 11.4 - 0.8) * 0.008
               + Math.sin(u * 21.7 + 0.3) * 0.004;
    } else {
      // Punta: cono asimétrico (taper más agresivo que la base)
      const u = (t - 0.78) / 0.22;
      // doble taper: rápido al principio, luego nub redondeado
      const sharp = Math.pow(1 - u, 1.85);
      const round = Math.pow(1 - u, 0.6);
      profile = 0.90 * sharp + 0.05 * round * (1 - u);
    }
    // Suaves ondulaciones longitudinales (hint de filas de granos)
    const ridges = Math.sin(t * 32 + 0.4) * 0.003 + Math.cos(t * 27 - 1.2) * 0.002;
    points.push(new THREE.Vector2(COB_RADIUS * Math.max(0.025, profile) + ridges, y));
  }
  const geo = new THREE.LatheGeometry(points, 224);

  // Deformación de vértices: aporta el realismo orgánico que un perfil
  // lathe nunca puede dar por sí solo.
  //   1) Lóbulos azimutales irregulares (la sección transversal no es
  //      perfectamente circular en una mazorca real).
  //   2) Hex-tiles de granos con tamaño variable, granos subdesarrollados
  //      y un sutil TWIST helicoidal en las filas (las hileras siguen una
  //      hélice muy abierta, no son perfectamente verticales).
  //   3) Curvatura asimétrica suave + jitter de baja frecuencia para
  //      romper la simetría rotacional perfecta.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.sqrt(v.x * v.x + v.z * v.z);
    if (r < 1e-4) continue;
    const theta = Math.atan2(v.z, v.x);
    const yNorm = (v.y + COB_HEIGHT / 2) / COB_HEIGHT;

    // (1) Lóbulos azimutales — tres frecuencias para "casi-redondo pero
    // no del todo". El fade no es simétrico (cae más cerca de la punta).
    const lobeFade = Math.pow(Math.sin(yNorm * Math.PI), 0.7);
    const azimuthal = (
      Math.cos(theta * 3 + 0.7 + yNorm * 0.4) * 0.018 +
      Math.cos(theta * 5 - 0.3 + yNorm * 0.7) * 0.010 +
      Math.cos(theta * 7 + 1.2) * 0.006 +
      Math.cos(theta * 13 - 0.8) * 0.0035
    ) * lobeFade;

    // (2) Hex-tiles de granos con twist helicoidal sutil
    const COLS = 22, ROWS = 32;
    const twist = (yNorm - 0.5) * 0.28; // hélice MUY suave
    const col = ((theta + twist) / (Math.PI * 2)) * COLS;
    const rowIdx = Math.floor(yNorm * ROWS);
    const stagger = (rowIdx % 2) * 0.5;
    const colIdx = Math.floor(col + stagger);
    const colMod = (col + stagger) - colIdx - 0.5;
    const rowMod = (yNorm * ROWS) - rowIdx - 0.5;
    const h = Math.abs(Math.sin(rowIdx * 12.9898 + colIdx * 78.233) * 43758.5453);
    const rand = h - Math.floor(h);
    const kernelScale = 0.74 + rand * 0.42;
    // Más granos subdesarrollados cerca de la punta y la base
    const yExtreme = Math.max(0, Math.abs(yNorm - 0.5) * 2 - 0.55);
    const missingProb = 0.04 + yExtreme * 0.32;
    const underdev = rand < missingProb ? 0.32 : 1.0;
    // Algunos granos planos ("calvos") — patrón natural
    const bald = (rand > 0.93 && yExtreme < 0.3) ? 0.55 : 1.0;
    const bump = Math.exp(-(colMod * colMod + rowMod * rowMod) * 14)
               * 0.024 * kernelScale * underdev * bald;

    // (3) Jitter orgánico de baja frecuencia (rompe la simetría perfecta)
    const jitter = (
      Math.sin(theta * 2 + yNorm * 6.7) * Math.cos(yNorm * 11.3 + theta * 1.4) * 0.006 +
      Math.sin(theta * 4 - yNorm * 3.1 + 0.7) * 0.004
    ) * lobeFade;

    const newR = r + bump + azimuthal + jitter;

    // (4) Curvatura asimétrica: la mazorca no es recta. Tiene una
    // curva natural más pronunciada hacia un lado (eje X), más sutil
    // perpendicular (eje Z). Real corn cobs cuelgan con leve banana shape.
    const bendShape = 1 - Math.pow(Math.abs(yNorm * 2 - 1), 2.1);
    const bendX = bendShape * -0.028;
    const bendZ = Math.sin(yNorm * Math.PI * 0.9) * 0.014;

    v.x = Math.cos(theta) * newR + bendX;
    v.z = Math.sin(theta) * newR + bendZ;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildHuskGeometry({
  length = 1.55,
  width = 0.45,
  peel = 0,
  seed = 0,
  asymmetry = 0,
} = {}) {
  // Hoja envolvente del maíz (husk). Forma orgánica con:
  // - taper asimétrico (lado izquierdo y derecho con anchos ligeramente
  //   distintos — las hojas reales no son perfectamente simétricas).
  // - punta puntiaguda (no recortada), con leve curl lateral.
  // - costilla central elevada + nervaduras paralelas leves.
  // - borde ondulado (frilly) en lugar de recto.
  // peel ∈ [0,1] controla qué tanto se aleja la hoja del eje del cob.
  const lengthSegs = 40;
  const widthSegs = 12;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Hash determinístico para variar cada hoja individualmente
  const rnd = (n) => {
    const x = Math.sin((seed + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const y = -length * 0.06 + t * length;
    // Taper natural: ancha en el medio-bajo, se cierra puntiaguda al final
    const tipFade = 1 - Math.pow(Math.max(0, t - 0.78) / 0.22, 1.4);
    const taper = (
      Math.sin(Math.pow(t, 0.7) * Math.PI * 0.96) * 0.85 + 0.15
    ) * tipFade;

    // Curvatura: la base se mantiene cerca del eje, la punta se aleja
    const peelCurve = peel * Math.pow(t, 1.35) * 0.62;
    const curlZ =
      Math.sin(t * Math.PI * 0.85) * 0.20 +
      Math.pow(t, 2) * 0.18 +
      peelCurve;
    // Curl lateral asimétrico — las hojas se torcen ligeramente hacia un lado
    const curlX = asymmetry * Math.sin(t * Math.PI * 1.2) * 0.14;

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const xRaw = (u - 0.5) * 2;
      // Ancho asimétrico (lado izq ≠ lado der)
      const sideBias = xRaw < 0
        ? (1 + asymmetry * 0.18)
        : (1 - asymmetry * 0.18);
      const w = width * Math.max(0.025, taper) * sideBias;
      // Borde ondulado (frilly): pequeñas ondulaciones del contorno
      const edgeRipple = (1 - Math.pow(Math.abs(xRaw), 0.7)) *
        Math.sin(t * 14 + xRaw * 3.4 + seed) * 0.015;
      const x = xRaw * w + curlX + edgeRipple;
      // Costilla central elevada (rib) + nervaduras secundarias
      const rib = Math.exp(-Math.abs(xRaw) * 6) * 0.045;
      const secondaryRib = Math.cos(xRaw * 18) * 0.006 * (1 - Math.abs(xRaw));
      // Ondulación lateral organica
      const lateralWave =
        Math.sin(t * 7.2 + xRaw * 2.1 + seed) * 0.014 * (1 - peel * 0.35) +
        Math.cos(t * 13.5 + xRaw * 1.4) * 0.006;
      // Pliegue longitudinal sutil (las hojas tienden a doblarse en el eje)
      const fold = (1 - Math.pow(Math.abs(xRaw), 2.4)) * 0.02 * (1 - t * 0.6);
      positions.push(
        x,
        y,
        curlZ + rib + secondaryRib + lateralWave - fold,
      );
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
  // Mecha de barbas (silk) saliendo de la punta de la mazorca.
  // Hash determinístico (no Math.random) → la mecha no cambia entre
  // re-renders; cada hebra tiene grosor, longitud y curva propios.
  const strands = [];
  const COUNT = 32;
  const hash = (n) => {
    const x = Math.sin(n * 91.3 + 7.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < COUNT; i++) {
    const r1 = hash(i * 3 + 1);
    const r2 = hash(i * 3 + 2);
    const r3 = hash(i * 3 + 3);
    const r4 = hash(i * 5 + 11);
    const angle = (i / COUNT) * Math.PI * 2 + r1 * 0.5;
    const droop = 0.30 + r2 * 0.55;
    const sway = (r3 - 0.5) * 0.28;
    const swayZ = (r4 - 0.5) * 0.28;
    const length = 0.48 + r1 * 0.52;
    const tipY = COB_HEIGHT / 2 - 0.01;

    const start = new THREE.Vector3(
      Math.cos(angle) * 0.05,
      tipY,
      Math.sin(angle) * 0.05,
    );
    const mid = new THREE.Vector3(
      Math.cos(angle) * (0.07 + droop * 0.22) + sway * 0.4,
      tipY + length * 0.52,
      Math.sin(angle) * (0.07 + droop * 0.22) + swayZ * 0.4,
    );
    const tip = new THREE.Vector3(
      Math.cos(angle) * (0.16 + droop * 0.6) + sway * 1.6,
      tipY + length - droop * 0.12,
      Math.sin(angle) * (0.16 + droop * 0.6) + swayZ * 1.6,
    );
    const curve = new THREE.CatmullRomCurve3([start, mid, tip]);
    // Grosor variable por hebra (algunas más finas que otras)
    const radius = 0.0028 + r2 * 0.0032;
    const tube = new THREE.TubeGeometry(curve, 16, radius, 5, false);
    strands.push(tube);
  }
  return mergeBufferGeometries(strands);
}

function mergeBufferGeometries(geos) {
  // Implementación mínima sin depender de BufferGeometryUtils.
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIdx);
  let pOff = 0, nOff = 0, iOff = 0, vBase = 0;
  for (const g of geos) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    positions.set(p, pOff);
    normals.set(n, nOff);
    pOff += p.length; nOff += n.length;
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
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

export default function CornModel() {
  const groupRef = useRef(null);

  const cobGeometry = useMemo(buildCobGeometry, []);
  const silkGeometry = useMemo(buildSilkGeometry, []);

  // 7 hojas: 5 envolventes + 2 dobladas hacia atrás (revelan los granos)
  // Cada hoja con seed/asymmetry/length/width únicos → ninguna idéntica
  const huskConfig = useMemo(
    () => [
      { peel: 0.08, length: 1.62, width: 0.46, seed: 1, asymmetry: -0.35 },
      { peel: 0.14, length: 1.5,  width: 0.42, seed: 2, asymmetry:  0.22 },
      { peel: 0.11, length: 1.58, width: 0.48, seed: 3, asymmetry: -0.15 },
      { peel: 0.18, length: 1.46, width: 0.43, seed: 4, asymmetry:  0.30 },
      { peel: 0.22, length: 1.52, width: 0.45, seed: 5, asymmetry: -0.20 },
      { peel: 0.88, length: 1.38, width: 0.50, seed: 6, asymmetry:  0.45 }, // peel-back
      { peel: 0.72, length: 1.32, width: 0.40, seed: 7, asymmetry: -0.40 }, // peel-back
    ],
    [],
  );
  const huskGeometries = useMemo(
    () => huskConfig.map((cfg) => buildHuskGeometry(cfg)),
    [huskConfig],
  );

  const cornColor = useMemo(makeCornColorTexture, []);
  const cornNormal = useMemo(makeCornNormalTexture, []);
  const cornRoughness = useMemo(makeCornRoughnessTexture, []);
  const huskColor = useMemo(makeHuskColorTexture, []);
  const huskNormal = useMemo(makeHuskNormalTexture, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.02;
  });

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}>
      {/* Mazorca */}
      <mesh geometry={cobGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          map={cornColor}
          normalMap={cornNormal}
          normalScale={[1.65, 1.65]}
          roughnessMap={cornRoughness}
          roughness={0.50}
          metalness={0.02}
          clearcoat={0.55}
          clearcoatRoughness={0.28}
          envMapIntensity={1.15}
          sheen={0.20}
          sheenColor="#fef3c7"
          sheenRoughness={0.6}
          transmission={0.05}
          thickness={0.15}
          attenuationColor="#fbbf24"
          attenuationDistance={0.4}
          ior={1.42}
        />
      </mesh>

      {/* Barbas (silk) saliendo por la punta */}
      <mesh geometry={silkGeometry} castShadow={false}>
        <meshPhysicalMaterial
          color="#fef3c7"
          roughness={0.45}
          metalness={0}
          sheen={1}
          sheenColor="#fff7d6"
          sheenRoughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hojas (husks) en la base — distribución ligeramente irregular
          en ángulo y radio para evitar look "estrella perfecta" */}
      {huskConfig.map((cfg, i) => {
        // Espaciado angular con jitter determinístico
        const baseAngle = (i / huskConfig.length) * Math.PI * 2 + 0.2;
        const angleJitter = ((cfg.seed * 0.37) % 1 - 0.5) * 0.32;
        const angle = baseAngle + angleJitter;
        const radialJitter = 0.62 + ((cfg.seed * 0.71) % 1) * 0.18;
        const tilt = 0.15 + ((cfg.seed % 3) * 0.04) + (i % 2) * 0.03;
        const zRotation = cfg.asymmetry * 0.25;
        const scale = 0.98 + ((cfg.seed * 0.91) % 1) * 0.14;
        return (
          <mesh
            key={i}
            geometry={huskGeometries[i]}
            position={[
              Math.cos(angle) * COB_RADIUS * radialJitter,
              -COB_HEIGHT * 0.46,
              Math.sin(angle) * COB_RADIUS * radialJitter,
            ]}
            rotation={[tilt, angle + Math.PI / 2, zRotation]}
            scale={scale}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              map={huskColor}
              normalMap={huskNormal}
              normalScale={[1.1, 1.1]}
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
