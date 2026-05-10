import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeLeafColorTexture,
  makeLeafNormalTexture,
  makeWatermelonColorTexture,
  makeWatermelonFleshTexture,
  makeWatermelonNormalTexture,
} from '../textures';

// =====================================================
// Sandía: pieza completa + rebanada lateral mostrando la
// pulpa rosada y semillas instanciadas (presentación de
// marketing). Materiales PBR con clearcoat para el lustre
// céreo de la cáscara y sheen sutil en la pulpa.
// =====================================================

const RADIUS = 1.0;

function buildRindGeometry() {
  const geo = new THREE.SphereGeometry(RADIUS, 128, 80);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    const big =
      Math.sin(v.x * 2.6) * Math.cos(v.y * 2.4) * Math.sin(v.z * 2.0) * 0.012;
    v.setLength(len + big);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.scale(1, 0.92, 1);
  return geo;
}

function buildStemGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, RADIUS * 0.88, 0),
    new THREE.Vector3(0.05, RADIUS * 0.88 + 0.13, 0.04),
    new THREE.Vector3(-0.02, RADIUS * 0.88 + 0.24, -0.05),
    new THREE.Vector3(0.08, RADIUS * 0.88 + 0.36, 0.02),
  ]);
  return new THREE.TubeGeometry(curve, 24, 0.04, 14, false);
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
//
// Construimos una rebanada como una tajada extruida:
//  - Shape: media-luna (semicírculo con un arco interior
//           más pequeño para la cáscara blanca)
//  - Extrude: profundidad pequeña → look de "tajada"
// La textura de pulpa va en las caras frontales (materialIndex 0)
// y la cáscara verde va en los bordes (materialIndex 1).
// =====================================================

const SLICE_RADIUS = 0.75;
const SLICE_DEPTH = 0.32;

function buildSliceFleshGeometry() {
  const shape = new THREE.Shape();
  const r = SLICE_RADIUS;
  shape.moveTo(-r, 0);
  shape.absarc(0, 0, r, Math.PI, 0, true);
  shape.lineTo(-r, 0);

  // ExtrudeGeometry asigna materialIndex 0 a top/bottom y 1 a sides.
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: SLICE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 64,
  });
  geo.translate(0, 0, -SLICE_DEPTH / 2);
  // Reasignar UVs en X/Y (las del extrude para top/bottom van en world coords)
  return remapSliceUVs(geo);
}

function remapSliceUVs(geo) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const r = SLICE_RADIUS;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Mapear el rectángulo bounding al UV [0,1]
    const u = (x + r) / (2 * r);
    const v = (y + 0) / r;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

function buildSliceRindGeometry() {
  // Una "cáscara" delgada que recubre el borde curvo de la rebanada.
  // Usamos un TubeGeometry sobre el arco semi-circular, con radio pequeño.
  const arcPoints = [];
  const segments = 64;
  const r = SLICE_RADIUS + 0.02;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = Math.PI - t * Math.PI;
    arcPoints.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(arcPoints, false);
  return new THREE.TubeGeometry(curve, 96, SLICE_DEPTH / 2 + 0.04, 18, false);
}

// Posiciones "realistas" de semillas en una rebanada, distribuidas en arcos.
function generateSeedPositions() {
  const seeds = [];
  // 3 anillos (más cerca del borde = más densos), evitando el centro absoluto
  const rings = [
    { r: SLICE_RADIUS * 0.45, count: 7 },
    { r: SLICE_RADIUS * 0.62, count: 9 },
    { r: SLICE_RADIUS * 0.78, count: 11 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const t = (i + 0.5) / ring.count;
      const a = Math.PI - t * Math.PI; // semicírculo superior
      // Las semillas se sitúan en la cara FRONTAL de la rebanada (z = +depth/2 + tiny offset)
      const jitter = (Math.random() - 0.5) * 0.04;
      const x = Math.cos(a) * (ring.r + jitter);
      const y = Math.sin(a) * (ring.r + jitter);
      seeds.push({
        position: [x, y, SLICE_DEPTH / 2 + 0.018],
        rotation: [0, 0, a + Math.PI / 2 + (Math.random() - 0.5) * 0.4],
      });
    }
  }
  return seeds;
}

function buildSeedGeometry() {
  // Semilla aplanada: esferoide muy achatado.
  const geo = new THREE.SphereGeometry(0.028, 14, 10);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.x *= 1.2;
    v.y *= 1.6;
    v.z *= 0.45;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
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

  const rindMap = useMemo(makeWatermelonColorTexture, []);
  const rindNormal = useMemo(makeWatermelonNormalTexture, []);
  const fleshMap = useMemo(makeWatermelonFleshTexture, []);
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
            normalScale={[0.95, 0.95]}
            roughness={0.38}
            metalness={0.04}
            clearcoat={0.85}
            clearcoatRoughness={0.28}
            envMapIntensity={1.15}
            sheen={0.2}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
          />
        </mesh>

        {/* Marca floral del extremo opuesto al tallo */}
        <mesh position={[0, -RADIUS * 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.012, 0.04, 24]} />
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

        {/* Hojas decorativas sobre el tallo */}
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
            normalScale={[0.8, 0.8]}
            roughness={0.55}
            metalness={0.02}
            clearcoat={0.55}
            clearcoatRoughness={0.4}
            sheen={0.6}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
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
            normalScale={[0.8, 0.8]}
            roughness={0.55}
            metalness={0.02}
            clearcoat={0.55}
            clearcoatRoughness={0.4}
            sheen={0.6}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* === Rebanada (a la derecha, ligeramente al frente) === */}
      <group position={[1.1, -0.55, 0.4]} rotation={[-Math.PI / 2.4, 0.05, -0.18]}>
        {/* Pulpa (cara frontal y trasera = pulpa rosada; bordes = blanco) */}
        <mesh geometry={sliceFleshGeo} castShadow receiveShadow>
          {/* Multi-material: 0 = top/bottom, 1 = sides (con bevel también va a 1) */}
          <meshPhysicalMaterial
            attach="material-0"
            map={fleshMap}
            roughness={0.52}
            metalness={0.02}
            clearcoat={0.45}
            clearcoatRoughness={0.42}
            transmission={0.08}
            thickness={0.4}
            attenuationColor="#fda4af"
            attenuationDistance={0.7}
            ior={1.33}
            sheen={0.35}
            sheenColor="#ffe4e6"
            sheenRoughness={0.55}
          />
          <meshPhysicalMaterial
            attach="material-1"
            color="#f8fafc"
            roughness={0.85}
            metalness={0}
          />
        </mesh>

        {/* Cáscara verde alrededor del borde curvo */}
        <mesh geometry={sliceRindGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            map={rindMap}
            normalMap={rindNormal}
            normalScale={[0.95, 0.95]}
            roughness={0.4}
            metalness={0.04}
            clearcoat={0.85}
            clearcoatRoughness={0.28}
            envMapIntensity={1.15}
          />
        </mesh>

        {/* Semillas instanciadas — cara frontal */}
        {seedPositions.map((s, i) => (
          <mesh
            key={`f-${i}`}
            geometry={seedGeo}
            position={s.position}
            rotation={s.rotation}
            castShadow
          >
            <meshPhysicalMaterial
              color="#1c0a00"
              roughness={0.35}
              metalness={0.1}
              clearcoat={0.9}
              clearcoatRoughness={0.15}
            />
          </mesh>
        ))}
        {/* Semillas también en la cara trasera (visibles si rotas) */}
        {seedPositions.map((s, i) => (
          <mesh
            key={`b-${i}`}
            geometry={seedGeo}
            position={[s.position[0], s.position[1], -SLICE_DEPTH / 2 - 0.018]}
            rotation={s.rotation}
            castShadow
          >
            <meshPhysicalMaterial
              color="#1c0a00"
              roughness={0.35}
              metalness={0.1}
              clearcoat={0.9}
              clearcoatRoughness={0.15}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
