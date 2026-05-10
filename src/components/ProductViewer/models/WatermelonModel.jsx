import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeLeafColorTexture,
  makeLeafNormalTexture,
  makeWatermelonColorTexture,
  makeWatermelonFleshTexture,
  makeWatermelonFleshNormalTexture,
  makeWatermelonFleshRoughnessTexture,
  makeWatermelonNormalTexture,
} from '../textures';

// =====================================================
// Sandía: pieza completa + rebanada lateral mostrando la
// pulpa rosada y semillas instanciadas (presentación de
// marketing). La pulpa usa transmisión + atenuación de color
// para simular subsurface scattering (la luz "atraviesa" la
// pulpa rosada como en una sandía real bañada de luz).
// =====================================================

const RADIUS = 1.0;

function buildRindGeometry() {
  const geo = new THREE.SphereGeometry(RADIUS, 192, 128);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    // Pequeña deformación orgánica para que no parezca una esfera perfecta
    const big =
      Math.sin(v.x * 2.6) * Math.cos(v.y * 2.4) * Math.sin(v.z * 2.0) * 0.014 +
      Math.sin(v.x * 6.1) * Math.cos(v.y * 5.7) * 0.004;
    v.setLength(len + big);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  // Forma ovalada (sandía no es esfera perfecta)
  geo.scale(1.02, 0.92, 1);
  return geo;
}

function buildStemGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, RADIUS * 0.88, 0),
    new THREE.Vector3(0.05, RADIUS * 0.88 + 0.13, 0.04),
    new THREE.Vector3(-0.02, RADIUS * 0.88 + 0.24, -0.05),
    new THREE.Vector3(0.08, RADIUS * 0.88 + 0.36, 0.02),
  ]);
  return new THREE.TubeGeometry(curve, 32, 0.04, 18, false);
}

function buildLeafGeometry() {
  const shape = new THREE.Shape();
  const lobes = 5;
  const N = 96;
  shape.moveTo(0, 0);
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const angle = Math.PI * (t - 0.5);
    const lobe = 0.7 + 0.28 * Math.cos(angle * lobes);
    const r = lobe * 0.95;
    const x = Math.sin(angle) * r;
    const y = (1 - Math.cos(angle)) * r * 0.95;
    shape.lineTo(x, y);
  }
  shape.lineTo(0, 0);

  const geo = new THREE.ShapeGeometry(shape, 28);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(
      i,
      Math.sin(y * 2.2) * 0.07 +
        Math.cos(x * 3.4) * 0.04 -
        Math.pow(Math.abs(x), 1.4) * 0.1,
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const uv = geo.attributes.uv;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, (x - minX) / (maxX - minX), (y - minY) / (maxY - minY));
  }
  uv.needsUpdate = true;
  return geo;
}

// ---------- Rebanada ----------

const SLICE_RADIUS = 0.78;
const SLICE_DEPTH = 0.34;

function buildSliceFleshGeometry() {
  const shape = new THREE.Shape();
  const r = SLICE_RADIUS;
  shape.moveTo(-r, 0);
  shape.absarc(0, 0, r, Math.PI, 0, true);
  shape.lineTo(-r, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: SLICE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 6,
    curveSegments: 96,
  });
  geo.translate(0, 0, -SLICE_DEPTH / 2);
  return remapSliceUVs(geo);
}

function remapSliceUVs(geo) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const r = SLICE_RADIUS;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Mapeo radial centrado: el centro de la rebanada → centro de la textura
    const u = (x + r) / (2 * r);
    const v = 0.5 + (y / (2 * r)); // y ∈ [0, r] → v ∈ [0.5, 1]
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

function buildSliceRindGeometry() {
  const arcPoints = [];
  const segments = 96;
  const r = SLICE_RADIUS + 0.02;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = Math.PI - t * Math.PI;
    arcPoints.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(arcPoints, false);
  return new THREE.TubeGeometry(curve, 128, SLICE_DEPTH / 2 + 0.04, 22, false);
}

// Posiciones realistas de semillas en una rebanada
function generateSeedPositions() {
  const seeds = [];
  const rings = [
    { r: SLICE_RADIUS * 0.42, count: 7 },
    { r: SLICE_RADIUS * 0.58, count: 9 },
    { r: SLICE_RADIUS * 0.74, count: 11 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const t = (i + 0.5) / ring.count;
      const a = Math.PI - t * Math.PI;
      const jitter = (Math.random() - 0.5) * 0.04;
      const x = Math.cos(a) * (ring.r + jitter);
      const y = Math.sin(a) * (ring.r + jitter);
      seeds.push({
        position: [x, y, SLICE_DEPTH / 2 + 0.020],
        rotation: [0, 0, a + Math.PI / 2 + (Math.random() - 0.5) * 0.4],
        scale: 0.85 + Math.random() * 0.3,
      });
    }
  }
  return seeds;
}

function buildSeedGeometry() {
  // Semilla aplanada con punta más estrecha
  const geo = new THREE.SphereGeometry(0.030, 18, 12);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.x *= 1.25;
    v.y *= 1.7;
    v.z *= 0.42;
    // Estrecharla en la punta superior
    if (v.y > 0) {
      v.x *= 1 - v.y * 0.18;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Pequeñas gotas de jugo sobre la pulpa para look fresco
function generateJuiceDropPositions() {
  const drops = [];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI - Math.PI;
    const r = SLICE_RADIUS * (0.2 + Math.random() * 0.55);
    const x = Math.cos(angle) * r;
    const y = Math.abs(Math.sin(angle)) * r * 0.9 + 0.04;
    drops.push({
      position: [x, y, SLICE_DEPTH / 2 + 0.024],
      scale: 0.6 + Math.random() * 1.1,
    });
  }
  return drops;
}

export default function WatermelonModel() {
  const groupRef = useRef(null);

  const rindGeo = useMemo(buildRindGeometry, []);
  const stemGeo = useMemo(buildStemGeometry, []);
  const leafGeo = useMemo(buildLeafGeometry, []);
  const sliceFleshGeo = useMemo(buildSliceFleshGeometry, []);
  const sliceRindGeo = useMemo(buildSliceRindGeometry, []);
  const seedGeo = useMemo(buildSeedGeometry, []);
  const seedPositions = useMemo(generateSeedPositions, []);
  const juiceDrops = useMemo(generateJuiceDropPositions, []);

  const rindMap = useMemo(makeWatermelonColorTexture, []);
  const rindNormal = useMemo(makeWatermelonNormalTexture, []);
  const fleshMap = useMemo(makeWatermelonFleshTexture, []);
  const fleshNormal = useMemo(makeWatermelonFleshNormalTexture, []);
  const fleshRoughness = useMemo(makeWatermelonFleshRoughnessTexture, []);
  const leafMap = useMemo(makeLeafColorTexture, []);
  const leafNormal = useMemo(makeLeafNormalTexture, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.015;
  });

  return (
    <group ref={groupRef} rotation={[0.06, 0, 0.04]}>
      {/* === Sandía completa (a la izquierda) === */}
      <group position={[-0.55, 0, -0.1]}>
        <mesh geometry={rindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.05, 1.05]}
            roughness={0.42}
            metalness={0.04}
            clearcoat={0.95}
            clearcoatRoughness={0.22}
            envMapIntensity={1.25}
            sheen={0.25}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
          />
        </mesh>

        {/* Marca floral del extremo opuesto al tallo */}
        <mesh position={[0, -RADIUS * 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.04, 32]} />
          <meshStandardMaterial color="#3f6212" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>

        {/* Tallo */}
        <mesh geometry={stemGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#4d7c0f"
            roughness={0.78}
            clearcoat={0.3}
            clearcoatRoughness={0.5}
          />
        </mesh>

        {/* Hojas decorativas */}
        <mesh
          geometry={leafGeo}
          position={[0.18, RADIUS * 0.88 + 0.08, -0.1]}
          rotation={[0.6, -0.3, 0.2]}
          scale={0.42}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            map={leafMap}
            normalMap={leafNormal}
            normalScale={[0.85, 0.85]}
            roughness={0.55}
            metalness={0.02}
            clearcoat={0.55}
            clearcoatRoughness={0.4}
            sheen={0.6}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
            transmission={0.18}
            thickness={0.05}
            ior={1.4}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          geometry={leafGeo}
          position={[-0.14, RADIUS * 0.88 + 0.12, 0.12]}
          rotation={[0.4, 0.5, -0.3]}
          scale={0.36}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            map={leafMap}
            normalMap={leafNormal}
            normalScale={[0.85, 0.85]}
            roughness={0.55}
            metalness={0.02}
            clearcoat={0.55}
            clearcoatRoughness={0.4}
            sheen={0.6}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
            transmission={0.18}
            thickness={0.05}
            ior={1.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* === Rebanada (a la derecha, ligeramente al frente) === */}
      <group position={[1.1, -0.55, 0.4]} rotation={[-Math.PI / 2.4, 0.05, -0.18]}>
        {/* Pulpa con SSS realista vía transmisión + atenuación */}
        <mesh geometry={sliceFleshGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            attach="material-0"
            map={fleshMap}
            normalMap={fleshNormal}
            normalScale={[0.55, 0.55]}
            roughnessMap={fleshRoughness}
            roughness={0.48}
            metalness={0.0}
            clearcoat={0.55}
            clearcoatRoughness={0.32}
            transmission={0.22}
            thickness={0.5}
            attenuationColor="#f23a55"
            attenuationDistance={0.55}
            ior={1.36}
            sheen={0.45}
            sheenColor="#fee2e2"
            sheenRoughness={0.55}
            envMapIntensity={1.15}
          />
          <meshPhysicalMaterial
            attach="material-1"
            color="#f8fafc"
            roughness={0.92}
            metalness={0}
          />
        </mesh>

        {/* Cáscara verde alrededor del borde curvo */}
        <mesh geometry={sliceRindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[1.05, 1.05]}
            roughness={0.4}
            metalness={0.04}
            clearcoat={0.9}
            clearcoatRoughness={0.25}
            envMapIntensity={1.2}
          />
        </mesh>

        {/* Semillas — cara frontal */}
        {seedPositions.map((s, i) => (
          <mesh
            key={`f-${i}`}
            geometry={seedGeo}
            position={s.position}
            rotation={s.rotation}
            scale={s.scale}
            castShadow
          >
            <meshPhysicalMaterial
              color="#1c0a00"
              roughness={0.28}
              metalness={0.18}
              clearcoat={1.0}
              clearcoatRoughness={0.12}
              envMapIntensity={1.4}
            />
          </mesh>
        ))}
        {/* Semillas — cara trasera */}
        {seedPositions.map((s, i) => (
          <mesh
            key={`b-${i}`}
            geometry={seedGeo}
            position={[s.position[0], s.position[1], -SLICE_DEPTH / 2 - 0.020]}
            rotation={s.rotation}
            scale={s.scale}
            castShadow
          >
            <meshPhysicalMaterial
              color="#1c0a00"
              roughness={0.28}
              metalness={0.18}
              clearcoat={1.0}
              clearcoatRoughness={0.12}
              envMapIntensity={1.4}
            />
          </mesh>
        ))}

        {/* Gotitas de jugo sobre la pulpa (look fresco) */}
        {juiceDrops.map((d, i) => (
          <mesh
            key={`drop-${i}`}
            position={d.position}
            scale={[d.scale * 0.013, d.scale * 0.013, d.scale * 0.006]}
          >
            <sphereGeometry args={[1, 16, 12]} />
            <meshPhysicalMaterial
              color="#f43f5e"
              roughness={0.06}
              metalness={0}
              clearcoat={1.0}
              clearcoatRoughness={0.04}
              transmission={0.85}
              thickness={0.5}
              ior={1.34}
              attenuationColor="#fb7185"
              attenuationDistance={0.5}
              envMapIntensity={1.6}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
