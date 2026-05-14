import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeCornColorTexture,
  makeCornNormalTexture,
  makeCornRoughnessTexture,
  makeHuskAlphaTexture,
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
  // POLISH (Prompt 1): además, asignamos color per-vertex para que ~10%
  // de los granos se sesguen hacia ámbar maduro (#d4a843) y otro pequeño
  // % hacia crema pálida (#fef3c7) — la textura procedural pinta el
  // grano base, y `vertexColors:true` lo multiplica para darle el matiz
  // de madurez sin necesitar instances ni segundo material.
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  // Inicializamos blanco (multiplicador neutro) — la textura manda
  for (let i = 0; i < colors.length; i++) colors[i] = 1.0;
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

    // Color de madurez per-grano. Otro hash independiente para no
    // correlacionar madurez con tamaño (en la mazorca real son
    // procesos distintos: tamaño = espacio disponible, madurez =
    // tiempo de exposición a azúcares).
    const matH = Math.abs(Math.sin(rowIdx * 7.31 + colIdx * 41.17) * 24631.7);
    const matR = matH - Math.floor(matH);
    let cr = 1.0, cg = 1.0, cb = 1.0;
    if (matR < 0.10) {
      // 10% maduro → ámbar (#d4a843 ÷ #f5d76e ≈ 0.86,0.79,0.62)
      cr = 0.86; cg = 0.79; cb = 0.62;
    } else if (matR < 0.16) {
      // 6% lechoso joven → ligeramente más pálido
      cr = 1.04; cg = 1.03; cb = 1.0;
    }
    colors[i * 3 + 0] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
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
  // Mecha de barbas (silk / pelos de elote). POLISH (Prompt 1):
  //   - densidad subida a ~140 hebras: una mazorca tiene cientos, pero
  //     >150 satura el draw y los pelos quedan apelmazados.
  //   - cada hebra tiene 4 control points (start, neck, mid, tip) en
  //     lugar de 3 → la curva cae con un "drop" más suave y orgánico
  //     (no parecen alambres rectos).
  //   - tubeRadius decrece desde la base hasta la punta (taper) — los
  //     estigmas reales son más gruesos donde emergen del cob.
  //   - color per-vertex con gradiente #d4a574 (base, cobrizo) →
  //     #f0d5a0 (punta, rubio claro). El material consume esto vía
  //     vertexColors:true para evitar uniformidad plástica.
  const strands = [];
  const colorBase = new THREE.Color('#d4a574');
  const colorTip = new THREE.Color('#f0d5a0');
  const STRANDS = 140;
  for (let i = 0; i < STRANDS; i++) {
    // Ángulo con jitter — anchos contra el ápice del cob, no en círculo perfecto
    const angle = (i / STRANDS) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const droop = 0.30 + Math.random() * 0.65;
    const sway = (Math.random() - 0.5) * 0.32;
    const length = 0.45 + Math.random() * 0.55;
    // El radio de emergencia varía: algunos pelos brotan más adentro,
    // otros del borde, para evitar que todos salgan del mismo aro
    const emerge = 0.015 + Math.random() * 0.05;

    const start = new THREE.Vector3(
      Math.cos(angle) * emerge,
      COB_HEIGHT / 2 - 0.025 + Math.random() * 0.02,
      Math.sin(angle) * emerge,
    );
    const neck = new THREE.Vector3(
      Math.cos(angle) * (emerge + 0.04),
      COB_HEIGHT / 2 + length * 0.18,
      Math.sin(angle) * (emerge + 0.04),
    );
    const mid = new THREE.Vector3(
      Math.cos(angle) * (0.06 + droop * 0.22) + sway * 0.6,
      COB_HEIGHT / 2 + length * 0.55,
      Math.sin(angle) * (0.06 + droop * 0.22) + sway * 0.6,
    );
    const tip = new THREE.Vector3(
      Math.cos(angle) * (0.20 + droop * 0.6) + sway * 1.6,
      COB_HEIGHT / 2 + length - droop * 0.22,
      Math.sin(angle) * (0.20 + droop * 0.6) + sway * 1.6,
    );
    const curve = new THREE.CatmullRomCurve3([start, neck, mid, tip]);
    const tubularSegments = 16;
    const radialSegments = 4; // muy delgado — radial 4 es suficiente
    const tube = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      0.0030,
      radialSegments,
      false,
    );

    // El TubeGeometry no soporta radio variable; aplicamos taper a mano:
    // escalamos cada vértice perpendicular al eje proporcional a (1 - t)^0.6
    // donde t es la posición a lo largo de la tube (0 base → 1 punta).
    const tp = tube.attributes.position;
    const verts = tp.count;
    const ringsCount = tubularSegments + 1;
    const ringSize = verts / ringsCount; // radial + cap verts
    for (let r = 0; r <= tubularSegments; r++) {
      const t = r / tubularSegments;
      const taper = Math.max(0.35, Math.pow(1 - t, 0.55));
      // Punto sobre la curva (el "centro" del anillo)
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

    // Vertex color per-strand: base oscura → punta clara
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
        // Fill blanco para geometrías sin color
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
  const huskAlpha = useMemo(makeHuskAlphaTexture, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.02;
  });

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}>
      {/* Mazorca. POLISH: vertexColors:true para que el atributo `color`
          (madurez 10% ámbar / lechoso) module el albedo de la textura. */}
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
          vertexColors
        />
      </mesh>

      {/* Barbas (silk). POLISH: vertexColors para el gradiente base→tip
          (#d4a574 → #f0d5a0). transmission alta + thickness bajo para la
          translucidez capilar característica del estigma de maíz.
          sheen alto con sheenColor cálido refuerza el "brillo seda". */}
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
