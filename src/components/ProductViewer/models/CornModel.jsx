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

const COB_HEIGHT = 1.7;
const COB_RADIUS = 0.46;

function buildCobGeometry() {
  const points = [];
  const segs = 96;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    // Perfil asimétrico (no un sin() perfecto): base con ramp-up corto,
    // hombro definido al ~78%, después taper más pronunciado hasta una
    // punta redondeada. Real corn cobs tienen un "shoulder" visible
    // donde dejan de crecer los granos y empieza la cima.
    let profile;
    if (t < 0.10) {
      // Base: rampa rápida desde el cabo donde se atorna al tallo
      profile = 0.05 + Math.pow(t / 0.10, 0.65) * 0.89;
    } else if (t < 0.78) {
      // Sección media: casi diámetro completo, con una panza muy sutil
      // hacia el centro y leves ondulaciones longitudinales (filas de granos)
      const u = (t - 0.10) / 0.68;
      profile = 0.94 + Math.sin(u * Math.PI) * 0.045 - Math.cos(u * 2.3 * Math.PI) * 0.010;
    } else {
      // Punta: taper más agresivo que la base + nubcita redondeada al final
      const u = (t - 0.78) / 0.22;
      profile = 0.95 * Math.pow(1 - u, 1.55) + 0.05 * (1 - u * u);
    }
    // Ondulación de filas de granos (muy sutil — el bulge real viene de
    // los hex-tiles abajo en el bucle de vértices)
    const ridges = Math.sin(t * 28 + 0.4) * 0.0035;
    points.push(new THREE.Vector2(COB_RADIUS * Math.max(0.03, profile) + ridges, y));
  }
  // Más segmentos radiales = los granos se ven con relieve real
  const geo = new THREE.LatheGeometry(points, 192);

  // Desplazamiento de vértices con tres capas:
  //   1) Lóbulos azimutales suaves — rompe la simetría rotacional perfecta
  //      (una mazorca real nunca es exactamente circular en corte).
  //   2) Hex-tiles de granos con variación per-grano de tamaño (algunos
  //      más hinchados, algunos subdesarrollados — patrón "natural").
  //   3) Bend longitudinal muy ligero (las mazorcas no son perfectamente
  //      rectas; siempre hay una leve curvatura por el crecimiento).
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.sqrt(v.x * v.x + v.z * v.z);
    if (r < 1e-4) continue;
    const theta = Math.atan2(v.z, v.x);
    const yNorm = (v.y + COB_HEIGHT / 2) / COB_HEIGHT;

    // (1) Lóbulos azimutales: 3 ondas anchas + 7 ondas finas
    // — fade hacia los extremos (donde se cierra el cob)
    const lobeFade = Math.sin(yNorm * Math.PI);
    const azimuthal = (Math.cos(theta * 3 + 0.7) * 0.013 +
                       Math.cos(theta * 7 - 0.3) * 0.005) * lobeFade;

    // (2) Hex-tiles de granos con variación per-grano
    const COLS = 22, ROWS = 28;
    const col = (theta / (Math.PI * 2)) * COLS;
    const rowIdx = Math.floor(yNorm * ROWS);
    const stagger = (rowIdx % 2) * 0.5;
    const colIdx = Math.floor(col + stagger);
    const colMod = (col + stagger) - colIdx - 0.5;
    const rowMod = (yNorm * ROWS) - rowIdx - 0.5;
    // Hash determinístico → tamaño per-grano (0.78–1.13×)
    const h = Math.abs(Math.sin(rowIdx * 12.9898 + colIdx * 78.233) * 43758.5453);
    const rand = h - Math.floor(h);
    const kernelScale = 0.78 + rand * 0.35;
    // ~4% de granos "subdesarrollados" (más chicos)
    const underdev = rand < 0.04 ? 0.45 : 1.0;
    const bump = Math.exp(-(colMod * colMod + rowMod * rowMod) * 14) * 0.020 * kernelScale * underdev;

    const newR = r + bump + azimuthal;

    // (3) Bend longitudinal muy leve (campana centrada en el medio)
    const bend = (1 - Math.pow(Math.abs(yNorm * 2 - 1), 2)) * -0.018;

    v.x = Math.cos(theta) * newR + bend;
    v.z = Math.sin(theta) * newR;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildHuskGeometry({ length = 1.55, width = 0.45, peel = 0 } = {}) {
  // Hoja con curva. peel = 0..1 controla qué tanto se "abre" la hoja
  // hacia afuera (0 = pegada, 1 = pulled-back).
  const lengthSegs = 28;
  const widthSegs = 8;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const y = -length * 0.05 + t * length;
    const taper =
      Math.sin(Math.pow(t, 0.85) * Math.PI) * 0.85 +
      0.15 -
      Math.max(0, (t - 0.92) * 4) ** 2 * 0.45;

    // Curvatura: la base se mantiene cerca del eje, la punta se aleja
    const peelCurve = peel * Math.pow(t, 1.4) * 0.55;
    const curlZ = Math.sin(t * Math.PI * 0.85) * 0.18 + Math.pow(t, 2) * 0.18 + peelCurve;

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const xRaw = (u - 0.5) * 2;
      const w = width * Math.max(0.04, taper);
      const x = xRaw * w;
      const rib = (1 - Math.abs(xRaw)) * 0.05;
      // Pequeña ondulación lateral para no parecer plana
      const lateralWave = Math.sin(t * 7 + xRaw * 2) * 0.012 * (1 - peel * 0.4);
      positions.push(x, y, curlZ + rib + lateralWave);
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
  // Una mecha de barbas (silk) — varias curvas Catmull-Rom delgadas.
  const strands = [];
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
    const droop = 0.35 + Math.random() * 0.5;
    const sway = (Math.random() - 0.5) * 0.25;
    const length = 0.55 + Math.random() * 0.45;

    const start = new THREE.Vector3(
      Math.cos(angle) * 0.04,
      COB_HEIGHT / 2 - 0.02,
      Math.sin(angle) * 0.04,
    );
    const mid = new THREE.Vector3(
      Math.cos(angle) * (0.06 + droop * 0.2) + sway,
      COB_HEIGHT / 2 + length * 0.55,
      Math.sin(angle) * (0.06 + droop * 0.2) + sway,
    );
    const tip = new THREE.Vector3(
      Math.cos(angle) * (0.18 + droop * 0.55) + sway * 1.5,
      COB_HEIGHT / 2 + length - droop * 0.15,
      Math.sin(angle) * (0.18 + droop * 0.55) + sway * 1.5,
    );
    const curve = new THREE.CatmullRomCurve3([start, mid, tip]);
    const tube = new THREE.TubeGeometry(curve, 14, 0.0035, 5, false);
    strands.push(tube);
  }
  // Merge manual
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

  // 6 hojas: 4 pegadas + 2 pulled-back (revelan los granos)
  const huskConfig = useMemo(
    () => [
      { peel: 0.1, length: 1.55, width: 0.45 },
      { peel: 0.15, length: 1.5, width: 0.42 },
      { peel: 0.12, length: 1.55, width: 0.46 },
      { peel: 0.18, length: 1.48, width: 0.44 },
      { peel: 0.85, length: 1.4, width: 0.48 }, // pulled-back
      { peel: 0.7, length: 1.35, width: 0.42 },  // pulled-back
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
          normalScale={[1.5, 1.5]}
          roughnessMap={cornRoughness}
          roughness={0.45}
          metalness={0.02}
          clearcoat={0.85}
          clearcoatRoughness={0.18}
          envMapIntensity={1.25}
          sheen={0.25}
          sheenColor="#fef3c7"
          sheenRoughness={0.55}
          // SSS sutil — los granos lácteos dejan pasar algo de luz
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

      {/* Hojas (husks) en la base */}
      {huskConfig.map((cfg, i) => {
        const angle = (i / huskConfig.length) * Math.PI * 2 + 0.2;
        const tilt = 0.18 + (i % 2) * 0.05;
        const scale = 1 + (i % 2) * 0.08;
        return (
          <mesh
            key={i}
            geometry={huskGeometries[i]}
            position={[
              Math.cos(angle) * COB_RADIUS * 0.7,
              -COB_HEIGHT * 0.45,
              Math.sin(angle) * COB_RADIUS * 0.7,
            ]}
            rotation={[tilt, angle + Math.PI / 2, 0]}
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
