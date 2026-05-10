import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeHuskColorTexture,
  makeHuskNormalTexture,
} from '../textures';

// =====================================================
// Maíz fotorrealista:
//   - Núcleo (cob): lathe interno color crema (la mazorca
//     desnuda apenas se ve, sólo en huecos entre granos).
//   - Granos: InstancedMesh con cientos de granos modelados
//     en 3D real, distribuidos en grid escalonado alrededor
//     del cob, con color y rotación per-instance.
//   - Hojas (husks) envolventes en la base, dos pulled-back.
//   - Barbas (silk) saliendo por la punta.
//
// El truco está en que cada grano es geometría real (no
// textura) → la luz resbala por cada uno individualmente
// y el resultado es indistinguible de una mazorca real.
// =====================================================

const COB_HEIGHT = 1.7;
const COB_RADIUS = 0.46;
const KERNEL_ROWS = 30;
const KERNEL_COLS = 22;

// Perfil del cob — usado tanto para la lathe interna como para
// posicionar los granos sobre la superficie.
function cobRadiusAt(t) {
  // t ∈ [0, 1] from bottom to top
  const taper =
    Math.sin(Math.pow(t, 0.92) * Math.PI) * 0.96 +
    0.04 -
    Math.max(0, (t - 0.94) * 8) ** 2 * 0.4;
  return COB_RADIUS * Math.max(0.04, taper);
}

function buildInnerCobGeometry() {
  const points = [];
  const segs = 36;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    // Reducimos un poco el radio para que el cob quede DEBAJO de los granos
    const r = cobRadiusAt(t) * 0.85;
    points.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(points, 64);
}

// Grano individual: dome rectangular tipo "diente" con esquinas
// redondeadas y base plana que asienta sobre el cob.
function buildKernelGeometry() {
  // Empezamos con una esfera y la deformamos a forma de grano:
  //   - Aplastada en Y (alto vs ancho)
  //   - Más estrecha en la punta (parte superior)
  //   - Casi cuadrada vista de frente, con esquinas suaves
  const geo = new THREE.SphereGeometry(1, 22, 14);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Aplanar bottom (la cara que toca el cob)
    if (v.y < 0) {
      v.y *= 0.18;
    } else {
      // El "domo" superior — más alto en el centro, plano en los lados
      v.y *= 1.0;
    }
    // Forma de diente: ligeramente más estrecho arriba
    if (v.y > 0) {
      const k = 1 - Math.pow(v.y, 1.4) * 0.22;
      v.x *= k;
      v.z *= k;
    }
    // Hacer la sección un poco más cuadrada (granos vistos de frente
    // tienen 4 caras planas con esquinas redondeadas) — usamos una
    // función "súper-elipse" suave.
    const r = Math.sqrt(v.x * v.x + v.z * v.z);
    if (r > 0.001) {
      const angle = Math.atan2(v.z, v.x);
      // Modular el radio según el ángulo: máximo en cardinales, mínimo
      // en diagonales — produce sección casi cuadrada redondeada.
      const squareness = 0.04;
      const rNew = r * (1 + Math.cos(angle * 4) * squareness);
      v.x = Math.cos(angle) * rNew;
      v.z = Math.sin(angle) * rNew;
    }
    // Surco frontal sutil (línea central del grano que mira al espectador)
    // El grano tiene su "frente" en +Z (lo orientaremos así al instanciar).
    if (v.z > 0.6 && v.y > -0.1) {
      v.z -= 0.04 * (v.y + 0.5);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function buildHuskGeometry({ length = 1.55, width = 0.45, peel = 0 } = {}) {
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
    const peelCurve = peel * Math.pow(t, 1.4) * 0.55;
    const curlZ = Math.sin(t * Math.PI * 0.85) * 0.18 + Math.pow(t, 2) * 0.18 + peelCurve;

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const xRaw = (u - 0.5) * 2;
      const w = width * Math.max(0.04, taper);
      const x = xRaw * w;
      const rib = (1 - Math.abs(xRaw)) * 0.05;
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
  const strands = [];
  let s = 41;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2 + rand() * 0.4;
    const droop = 0.35 + rand() * 0.5;
    const sway = (rand() - 0.5) * 0.25;
    const length = 0.55 + rand() * 0.45;

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
    strands.push(new THREE.TubeGeometry(curve, 14, 0.0035, 5, false));
  }
  return mergeBufferGeometries(strands);
}

function mergeBufferGeometries(geos) {
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

// Calcula posiciones, orientaciones y colores de los granos.
// Resultado: matrices listas para InstancedMesh.setMatrixAt + colores.
function generateKernelInstances() {
  const matrices = [];
  const colors = [];

  // Paleta de colores realista: amarillo cálido con variaciones
  const palette = [
    new THREE.Color('#fde68a'),
    new THREE.Color('#fcd34d'),
    new THREE.Color('#fbbf24'),
    new THREE.Color('#f59e0b'),
    new THREE.Color('#eab308'),
    new THREE.Color('#facc15'),
    new THREE.Color('#fef3c7'),
    new THREE.Color('#fff5cc'),
  ];

  let seed = 73;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0); // +Y local del grano

  for (let row = 0; row < KERNEL_ROWS; row++) {
    const tRow = (row + 0.5) / KERNEL_ROWS;
    const y = -COB_HEIGHT / 2 + tRow * COB_HEIGHT;
    const r = cobRadiusAt(tRow);
    if (r < COB_RADIUS * 0.18) continue; // saltar puntas demasiado finas

    // Stagger entre filas — desplazar columnas medio-paso
    const stagger = (row % 2) * (Math.PI / KERNEL_COLS);
    // Tamaño del grano proporcional al radio (las puntas tienen granos más pequeños)
    const sizeFactor = THREE.MathUtils.clamp(r / COB_RADIUS, 0.55, 1.1);
    const kernelW = (Math.PI * 2 * r / KERNEL_COLS) * 0.55 * sizeFactor;
    const kernelH = (COB_HEIGHT / KERNEL_ROWS) * 0.6 * sizeFactor;
    const kernelDepth = 0.05 * sizeFactor;

    // Tilt vertical: en los extremos el grano se inclina hacia el eje
    const tiltAngle = (tRow - 0.5) * Math.PI * 0.32;

    for (let col = 0; col < KERNEL_COLS; col++) {
      const theta = (col / KERNEL_COLS) * Math.PI * 2 + stagger;
      // Pequeño jitter para que no se vea perfectamente regular
      const jitterTheta = (rand() - 0.5) * 0.025;
      const jitterY = (rand() - 0.5) * 0.012;
      const jitterScale = 0.92 + rand() * 0.16;

      const t2 = theta + jitterTheta;
      // Posición sobre la superficie: el grano sobresale del cob
      const surfaceR = r + kernelDepth * 0.3;
      position.set(
        Math.cos(t2) * surfaceR,
        y + jitterY,
        Math.sin(t2) * surfaceR,
      );

      // Orientar: el +Y local apunta hacia afuera radialmente, con leve tilt
      const radialOut = new THREE.Vector3(Math.cos(t2), 0, Math.sin(t2));
      // Aplicar tilt vertical (hacia el eje en los extremos)
      radialOut.y = -Math.sin(tiltAngle) * 0.5;
      radialOut.normalize();
      quat.setFromUnitVectors(up, radialOut);

      // Rotación adicional alrededor del propio +Y para variar el "frente"
      const localRot = new THREE.Quaternion().setFromAxisAngle(up, rand() * 0.4 - 0.2);
      quat.multiply(localRot);

      scale.set(
        kernelW * jitterScale,
        (kernelDepth + 0.05) * jitterScale,
        kernelH * jitterScale,
      );
      matrix.compose(position, quat, scale);
      matrices.push(matrix.clone());

      // Color: mezcla aleatoria de la paleta + ligera variación adicional
      const baseIdx = Math.floor(rand() * palette.length);
      const baseColor = palette[baseIdx].clone();
      // Modular ligeramente con jitter
      const cj = 0.92 + rand() * 0.16;
      baseColor.multiplyScalar(cj);
      colors.push(baseColor);
    }
  }

  return { matrices, colors };
}

export default function CornModel() {
  const groupRef = useRef(null);
  const kernelMeshRef = useRef(null);

  const innerCobGeo = useMemo(buildInnerCobGeometry, []);
  const kernelGeo = useMemo(buildKernelGeometry, []);
  const silkGeometry = useMemo(buildSilkGeometry, []);

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

  const { matrices, colors } = useMemo(generateKernelInstances, []);
  const kernelCount = matrices.length;

  const huskColor = useMemo(makeHuskColorTexture, []);
  const huskNormal = useMemo(makeHuskNormalTexture, []);

  useEffect(() => {
    const mesh = kernelMeshRef.current;
    if (!mesh) return;
    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      if (mesh.setColorAt) mesh.setColorAt(i, colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, colors]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.02;
  });

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}>
      {/* Cob central (visible solo en intersticios entre granos) */}
      <mesh geometry={innerCobGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#ede2b8" roughness={0.78} metalness={0} />
      </mesh>

      {/* Granos — instanciados con per-instance color */}
      <instancedMesh
        ref={kernelMeshRef}
        args={[kernelGeo, undefined, kernelCount]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          roughness={0.32}
          metalness={0.04}
          clearcoat={0.95}
          clearcoatRoughness={0.18}
          envMapIntensity={1.25}
          sheen={0.25}
          sheenColor="#fef3c7"
          sheenRoughness={0.4}
        />
      </instancedMesh>

      {/* Barbas (silk) saliendo por la punta */}
      <mesh geometry={silkGeometry}>
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
