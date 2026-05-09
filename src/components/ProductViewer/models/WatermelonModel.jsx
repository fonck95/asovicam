import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeLeafColorTexture,
  makeWatermelonBumpTexture,
  makeWatermelonColorTexture,
} from '../textures';

// =====================================================
// Sandía: esfera ligeramente achatada con textura de
// franjas hecha en canvas 2D (color + bump). Sin shaders
// inyectados — sin custom GLSL. Tallo curvo y hoja arriba.
// =====================================================

const RADIUS = 1.05;

function buildRindGeometry() {
  const geo = new THREE.SphereGeometry(RADIUS, 96, 64);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  // Suaves bultos tipo melón para no parecer una bola perfecta.
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
  return new THREE.TubeGeometry(curve, 20, 0.04, 12, false);
}

function buildLeafGeometry() {
  // Hoja de sandía: lobulada (5 lóbulos suaves).
  const shape = new THREE.Shape();
  const lobes = 5;
  const N = 80;
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

  const geo = new THREE.ShapeGeometry(shape, 24);
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

  // UV ajustado al bbox para la textura de hoja.
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

export default function WatermelonModel() {
  const groupRef = useRef(null);

  const rindGeo = useMemo(buildRindGeometry, []);
  const stemGeo = useMemo(buildStemGeometry, []);
  const leafGeo = useMemo(buildLeafGeometry, []);

  const rindMap = useMemo(makeWatermelonColorTexture, []);
  const rindBump = useMemo(makeWatermelonBumpTexture, []);
  const leafMap = useMemo(makeLeafColorTexture, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.015;
  });

  return (
    <group ref={groupRef} rotation={[0.06, 0, 0.04]}>
      {/* Cáscara con franjas */}
      <mesh geometry={rindGeo} castShadow receiveShadow>
        <meshStandardMaterial
          map={rindMap}
          bumpMap={rindBump}
          bumpScale={0.018}
          roughness={0.4}
          metalness={0.04}
        />
      </mesh>

      {/* Marca del extremo opuesto al tallo (ojito floral) */}
      <mesh position={[0, -RADIUS * 0.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.012, 0.04, 24]} />
        <meshStandardMaterial color="#3f6212" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Tallo */}
      <mesh geometry={stemGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#4d7c0f" roughness={0.85} />
      </mesh>

      {/* Hoja decorativa sobre el tallo */}
      <mesh
        geometry={leafGeo}
        position={[0.18, RADIUS * 0.88 + 0.08, -0.1]}
        rotation={[0.6, -0.3, 0.2]}
        scale={0.42}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          map={leafMap}
          roughness={0.55}
          metalness={0.02}
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
        <meshStandardMaterial
          map={leafMap}
          roughness={0.55}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
