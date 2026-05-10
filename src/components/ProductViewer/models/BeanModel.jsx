import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeBeanSeedTexture,
  makeLeafColorTexture,
  makeLeafNormalTexture,
  makePodColorTexture,
  makePodNormalTexture,
} from '../textures';

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
  const geo = new THREE.SphereGeometry(0.085, 28, 18);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Achatado en Y, alargado en X, curvado en el plano XZ
    v.y *= 0.65;
    v.x *= 1.5;
    v.z += Math.sin(v.x * 4) * 0.012;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
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
  const leafMap = useMemo(makeLeafColorTexture, []);
  const leafNormal = useMemo(makeLeafNormalTexture, []);
  const seedMap = useMemo(makeBeanSeedTexture, []);

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

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.015;
  });

  const podMaterial = (
    <meshPhysicalMaterial
      map={podMap}
      normalMap={podNormal}
      normalScale={[1.0, 1.0]}
      roughness={0.42}
      metalness={0.04}
      clearcoat={0.55}
      clearcoatRoughness={0.35}
      sheen={0.3}
      sheenColor="#a3e635"
      sheenRoughness={0.55}
      envMapIntensity={1.0}
    />
  );

  return (
    <group ref={groupRef} rotation={[0.05, 0, -0.1]} position={[0.05, 0, 0]}>
      {/* Vaina cerrada (principal) */}
      <mesh geometry={closedPodGeo} castShadow receiveShadow position={[0, 0, 0.32]}>
        {podMaterial}
      </mesh>

      {/* Vaina abierta (mitad superior) — revela los frijoles */}
      <group position={[0, 0, -0.36]} rotation={[0, 0, 0]}>
        <mesh geometry={openTopGeo} castShadow receiveShadow rotation={[0.25, 0, 0]} position={[0, 0.05, 0]}>
          {podMaterial}
        </mesh>
        {/* Mitad inferior: misma media-vaina rotada 180° en el eje X */}
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
            rotation={[0, (i % 2) * 0.3, (i % 3) * 0.15]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              map={seedMap}
              roughness={0.32}
              metalness={0.05}
              clearcoat={0.85}
              clearcoatRoughness={0.18}
              sheen={0.2}
              sheenColor="#fbbf24"
              envMapIntensity={1.1}
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
