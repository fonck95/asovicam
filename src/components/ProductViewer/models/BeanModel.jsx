import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeBeanSeedNormalTexture,
  makeBeanSeedTexture,
  makeLeafColorTexture,
  makeLeafNormalTexture,
  makePodColorTexture,
  makePodInteriorTexture,
  makePodNormalTexture,
} from '../textures';
import PollenMotes from './PollenMotes';

// =====================================================
// Frijol: vaina cerrada (TubeGeometry curva con bultos)
// + vaina abierta detrás mostrando los frijoles dentro,
// + hojas trifoliadas. Materiales PBR con clearcoat para
// el lustre fresco y sheen sutil en las hojas.
// =====================================================

const POD_LENGTH = 1.95;
const POD_RADIUS = 0.18;
const SEED_COUNT = 5;

function buildPodHalfGeometry({ open = false } = {}) {
  // Construye media vaina (sólo la parte superior) — para la vaina
  // abierta usamos esto dos veces y separamos las dos mitades.
  // Cuando open = false, usamos la vaina completa (con interior fake).
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2, -0.06, 0),
    new THREE.Vector3(-POD_LENGTH / 4, 0.18, 0.04),
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(POD_LENGTH / 4, 0.18, -0.04),
    new THREE.Vector3(POD_LENGTH / 2, -0.06, 0),
  ]);

  const segs = 96;
  const radial = 24;
  const positions = [];
  const indices = [];
  const uvs = [];
  const frames = curve.computeFrenetFrames(segs, false);
  const points = curve.getSpacedPoints(segs);

  // Cuando open=true sólo barremos media circunferencia (PI)
  const arc = open ? Math.PI : Math.PI * 2;
  const radialUsed = open ? Math.floor(radial / 2) + 1 : radial;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const taper = Math.sin(t * Math.PI) * 0.85 + 0.15;
    const bumps = 1 + Math.sin(t * Math.PI * SEED_COUNT - Math.PI / 2) * 0.32;
    const r = POD_RADIUS * taper * bumps;
    const N = frames.normals[Math.min(i, segs - 1)];
    const B = frames.binormals[Math.min(i, segs - 1)];
    const P = points[i];

    for (let j = 0; j < radialUsed; j++) {
      const a = open
        ? -Math.PI / 2 + (j / (radialUsed - 1)) * arc
        : (j / radial) * arc;
      const nx = Math.cos(a);
      const ny = Math.sin(a) * 0.7;
      const radius = r;
      const x = P.x + (N.x * nx + B.x * ny) * radius;
      const y = P.y + (N.y * nx + B.y * ny) * radius;
      const z = P.z + (N.z * nx + B.z * ny) * radius;
      positions.push(x, y, z);
      uvs.push(j / (open ? radialUsed - 1 : radial), t);
    }
  }

  const cols = radialUsed;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < (open ? cols - 1 : cols); j++) {
      const a = i * cols + (open ? j : j);
      const b = i * cols + (open ? j + 1 : (j + 1) % cols);
      const c = (i + 1) * cols + (open ? j : j);
      const d = (i + 1) * cols + (open ? j + 1 : (j + 1) % cols);
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

function buildLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.32, 0.1, 0.55, 0.5, 0.42, 0.95);
  shape.bezierCurveTo(0.32, 1.18, 0.12, 1.32, 0, 1.36);
  shape.bezierCurveTo(-0.12, 1.32, -0.32, 1.18, -0.42, 0.95);
  shape.bezierCurveTo(-0.55, 0.5, -0.32, 0.1, 0, 0);

  const geo = new THREE.ShapeGeometry(shape, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z =
      Math.sin(y * 1.4) * 0.09 +
      Math.cos(x * 4) * 0.02 -
      Math.pow(Math.abs(x), 1.6) * 0.18;
    pos.setZ(i, z);
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

function buildStemGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2 - 0.04, -0.05, 0),
    new THREE.Vector3(-POD_LENGTH / 2 - 0.18, 0.18, 0.04),
    new THREE.Vector3(-POD_LENGTH / 2 - 0.32, 0.4, 0),
    new THREE.Vector3(-POD_LENGTH / 2 - 0.42, 0.55, 0.04),
  ]);
  return new THREE.TubeGeometry(curve, 24, 0.022, 10, false);
}

function buildBeanSeedGeometry() {
  // Frijol individual: esfera achatada y curvada (kidney bean).
  const geo = new THREE.SphereGeometry(0.085, 40, 24);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Achatado en Y, alargado en X, curvado en el plano XZ
    v.y *= 0.65;
    v.x *= 1.5;
    v.z += Math.sin(v.x * 4) * 0.012;
    // Hilum: pequeña indentación en el centro inferior (lateral)
    const hilumDist = Math.sqrt(v.x * v.x + (v.y + 0.04) * (v.y + 0.04));
    if (v.z > 0 && hilumDist < 0.03) {
      v.z -= 0.005 * Math.exp(-hilumDist * 80);
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // UV cilíndrico alrededor del eje Y. El offset 0.25 garantiza que el
  // centro de la textura (u=0.5) corresponda al lado +z del frijol —
  // que es justo donde está la indentación del hilum, alineando textura
  // y geometría. v cubre todo el rango vertical del frijol.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = ((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) + 0.25) % 1;
    const v2 = (y + 0.0553) / 0.1106; // y ∈ ±0.0553 (0.085 * 0.65)
    uv.setXY(i, u, Math.max(0, Math.min(1, v2)));
  }
  uv.needsUpdate = true;
  return geo;
}

export default function BeanModel() {
  const groupRef = useRef(null);

  const closedPodGeo = useMemo(() => buildPodHalfGeometry({ open: false }), []);
  const openTopGeo = useMemo(() => buildPodHalfGeometry({ open: true }), []);
  const leafGeo = useMemo(buildLeafGeometry, []);
  const stemGeo = useMemo(buildStemGeometry, []);
  const seedGeo = useMemo(buildBeanSeedGeometry, []);

  const podMap = useMemo(makePodColorTexture, []);
  const podNormal = useMemo(makePodNormalTexture, []);
  const podInteriorMap = useMemo(makePodInteriorTexture, []);
  const leafMap = useMemo(makeLeafColorTexture, []);
  const leafNormal = useMemo(makeLeafNormalTexture, []);
  const seedMap = useMemo(makeBeanSeedTexture, []);
  const seedNormal = useMemo(makeBeanSeedNormalTexture, []);

  // Posiciones de los frijoles dentro de la vaina abierta
  const seedPositions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < SEED_COUNT; i++) {
      const t = (i + 0.5) / SEED_COUNT;
      const x = -POD_LENGTH / 2 + t * POD_LENGTH;
      // Sigue la curva de la vaina (idéntica a la curve del pod)
      const y = 0.22 - Math.pow((t - 0.5) * 2, 2) * 0.28;
      const z = Math.sin((t - 0.5) * Math.PI) * 0.04;
      arr.push([x, y - 0.06, z]);
    }
    return arr;
  }, []);

  // Organic breathing: two-octave float + slow yaw drift simulating the
  // pod resting on a surface with light wind. Different phase from corn
  // so when both are on screen they don't move in lockstep.
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.position.y =
      Math.sin(t * 0.55 + 0.6) * 0.013 + Math.sin(t * 1.9) * 0.004;
    groupRef.current.rotation.y = Math.sin(t * 0.32) * 0.04;
  });

  const podMaterial = (
    <meshPhysicalMaterial
      map={podMap}
      normalMap={podNormal}
      normalScale={[1.2, 1.2]}
      roughness={0.38}
      metalness={0.04}
      clearcoat={0.7}
      clearcoatRoughness={0.28}
      sheen={0.4}
      sheenColor="#a3e635"
      sheenRoughness={0.5}
      envMapIntensity={1.15}
      transmission={0.12}
      thickness={0.1}
      attenuationColor="#84cc16"
      attenuationDistance={0.4}
      ior={1.4}
      side={THREE.DoubleSide}
    />
  );

  const podInteriorMaterial = (
    <meshPhysicalMaterial
      map={podInteriorMap}
      roughness={0.65}
      metalness={0.0}
      clearcoat={0.45}
      clearcoatRoughness={0.4}
      sheen={0.3}
      sheenColor="#e9f3c9"
      sheenRoughness={0.55}
      envMapIntensity={1.0}
      side={THREE.BackSide}
    />
  );

  return (
    <group ref={groupRef} rotation={[0.05, 0, -0.1]} position={[0.05, 0, 0]}>
      <PollenMotes
        count={22}
        radius={1.6}
        height={1.4}
        color="#bef264"
        size={0.014}
        speed={0.28}
        opacity={0.6}
      />

      {/* Vaina cerrada (principal) */}
      <mesh geometry={closedPodGeo} castShadow receiveShadow position={[0, 0, 0.32]}>
        {podMaterial}
      </mesh>

      {/* Vaina abierta (mitad superior) — revela los frijoles */}
      <group position={[0, 0, -0.36]} rotation={[0, 0, 0]}>
        {/* Membrana interior: render BackSide debajo de cada mitad para
            que cuando mires hacia adentro, veas el verde pálido del
            interior de la vaina (no el verde brillante exterior) */}
        <mesh geometry={openTopGeo} castShadow={false} receiveShadow rotation={[0.25, 0, 0]} position={[0, 0.05, 0]}>
          {podInteriorMaterial}
        </mesh>
        <mesh
          geometry={openTopGeo}
          castShadow={false}
          receiveShadow
          rotation={[Math.PI - 0.25, 0, 0]}
          position={[0, -0.05, 0]}
        >
          {podInteriorMaterial}
        </mesh>

        {/* Capa exterior: mitad superior */}
        <mesh geometry={openTopGeo} castShadow receiveShadow rotation={[0.25, 0, 0]} position={[0, 0.05, 0]}>
          {podMaterial}
        </mesh>
        {/* Capa exterior: mitad inferior rotada */}
        <mesh
          geometry={openTopGeo}
          castShadow
          receiveShadow
          rotation={[Math.PI - 0.25, 0, 0]}
          position={[0, -0.05, 0]}
        >
          {podMaterial}
        </mesh>

        {/* Frijoles dentro de la vaina abierta */}
        {seedPositions.map((p, i) => (
          <mesh
            key={i}
            geometry={seedGeo}
            position={[p[0], p[1] - 0.02, p[2]]}
            rotation={[0, (i % 2) * 0.3 + (i * 0.13), (i % 3) * 0.15]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              map={seedMap}
              normalMap={seedNormal}
              normalScale={[0.8, 0.8]}
              roughness={0.34}
              metalness={0.06}
              clearcoat={0.95}
              clearcoatRoughness={0.14}
              sheen={0.25}
              sheenColor="#fbbf24"
              sheenRoughness={0.5}
              envMapIntensity={1.25}
            />
          </mesh>
        ))}
      </group>

      {/* Tallo */}
      <mesh geometry={stemGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#65a30d"
          roughness={0.65}
          clearcoat={0.3}
          clearcoatRoughness={0.4}
        />
      </mesh>

      {/* Hojas trifoliadas */}
      {[
        { pos: [-POD_LENGTH / 2 - 0.42, 0.55, 0.02], rot: [0.4, 0.2, -0.5], scale: 0.6 },
        { pos: [-POD_LENGTH / 2 - 0.34, 0.62, -0.18], rot: [0.5, -0.4, -0.2], scale: 0.5 },
        { pos: [-POD_LENGTH / 2 - 0.5, 0.48, 0.22], rot: [0.3, 0.6, -0.7], scale: 0.55 },
      ].map((cfg, i) => (
        <mesh
          key={i}
          geometry={leafGeo}
          position={cfg.pos}
          rotation={cfg.rot}
          scale={cfg.scale}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            map={leafMap}
            normalMap={leafNormal}
            normalScale={[0.85, 0.85]}
            roughness={0.55}
            metalness={0.02}
            clearcoat={0.5}
            clearcoatRoughness={0.45}
            sheen={0.55}
            sheenColor="#a3e635"
            sheenRoughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
