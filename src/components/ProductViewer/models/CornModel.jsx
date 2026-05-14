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
  const segs = 64;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    // Taper base — mismo perfil global anterior (hombros chunky, tip estrecho)
    const baseTaper =
      Math.sin(Math.pow(t, 0.92) * Math.PI) * 0.96 +
      0.04 -
      Math.max(0, (t - 0.94) * 8) ** 2 * 0.4;
    // Variación irregular en el contorno: frecuencias no-armónicas para
    // evitar la simetría matemática de un cilindro perfecto.
    const profileWob =
      Math.sin(t * 4.7 + 0.6) * 0.028 +
      Math.sin(t * 8.3 + 1.4) * 0.014;
    const microWob = Math.sin(t * 28) * 0.006;
    const taper = baseTaper + profileWob;
    points.push(new THREE.Vector2(COB_RADIUS * Math.max(0.04, taper) + microWob, y));
  }
  // Más segmentos radiales = los granos se ven con relieve real
  const geo = new THREE.LatheGeometry(points, 192);

  // Bumps de grano con variación por celda: hash determinista por
  // (col, row) → cada grano tiene su propio tamaño. Los granos del tip
  // son más pequeños (convergencia natural hacia la punta).
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const COLS = 22, ROWS = 28;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.sqrt(v.x * v.x + v.z * v.z);
    if (r < 1e-4) continue;
    const theta = Math.atan2(v.z, v.x);
    const yNorm = (v.y + COB_HEIGHT / 2) / COB_HEIGHT;
    const col = (theta / (Math.PI * 2)) * COLS;
    const stagger = (Math.floor(yNorm * ROWS) % 2) * 0.5;
    const colMod = (col + stagger) - Math.floor(col + stagger) - 0.5;
    const rowMod = (yNorm * ROWS) - Math.floor(yNorm * ROWS) - 0.5;

    // Hash por celda (col, row) → variación estable de tamaño por grano
    const colIdx = ((Math.floor(col + stagger) % COLS) + COLS) % COLS;
    const rowIdx = Math.floor(yNorm * ROWS);
    let h = (colIdx * 73856093) ^ (rowIdx * 19349663);
    h = (h ^ (h >>> 13)) >>> 0;
    const kernelRand = (h & 0xffff) / 0xffff;            // 0..1
    const kernelScale = 0.55 + kernelRand * 0.75;        // 0.55..1.30 (algunos
    // notoriamente más hinchados, otros más planos)
    // Los granos del tip se hacen más pequeños (la punta de la mazorca real
    // tiene granos enanos o subdesarrollados que se aplanan).
    const tipFade = 1 - Math.pow(Math.max(0, yNorm - 0.72) / 0.28, 1.6) * 0.65;
    // Bumpear el grano hacia afuera con campana 2D
    const bump =
      Math.exp(-(colMod * colMod + rowMod * rowMod) * 14) *
      0.020 *
      kernelScale *
      Math.max(0.18, tipFade);
    const newR = r + bump;
    v.x = Math.cos(theta) * newR;
    v.z = Math.sin(theta) * newR;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;

  // Curvatura sutil tipo "banana": rompe la perfecta simetría de revolución
  // del Lathe. Amplitud pequeña (~3 mm sobre cob de 1.7 m) — apenas
  // perceptible pero suficiente para que el ojo deje de leerlo como cilindro.
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yNorm = (v.y + COB_HEIGHT / 2) / COB_HEIGHT;
    v.x += Math.sin(yNorm * Math.PI) * 0.032;
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
