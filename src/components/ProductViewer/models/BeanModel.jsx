import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeLeafColorTexture, makePodColorTexture } from '../textures';

// =====================================================
// Frijol: una vaina curva (TubeGeometry sobre Catmull-Rom)
// con bultos visibles donde están los frijoles, más una
// hoja trifoliada al lado. Sin shaders inyectados, sin
// frijoles internos en mallas separadas: el bulto del propio
// tubo + textura procedural ya da la lectura correcta.
// =====================================================

const POD_LENGTH = 2.0;
const POD_RADIUS = 0.18;

function buildPodGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2, -0.06, 0),
    new THREE.Vector3(-POD_LENGTH / 4, 0.18, 0.04),
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(POD_LENGTH / 4, 0.18, -0.04),
    new THREE.Vector3(POD_LENGTH / 2, -0.06, 0),
  ]);

  const segs = 96;
  const radial = 20;
  const positions = [];
  const indices = [];
  const uvs = [];
  const frames = curve.computeFrenetFrames(segs, false);
  const points = curve.getSpacedPoints(segs);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // Suave taper en las puntas
    const taper = Math.sin(t * Math.PI) * 0.85 + 0.15;
    // Bultos donde están los frijoles (5 frijoles visibles)
    const bumps = 1 + Math.sin(t * Math.PI * 5 - Math.PI / 2) * 0.32;
    const r = POD_RADIUS * taper * bumps;
    const N = frames.normals[Math.min(i, segs - 1)];
    const B = frames.binormals[Math.min(i, segs - 1)];
    const P = points[i];

    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // Sección achatada (vaina más fina arriba/abajo)
      const nx = Math.cos(a);
      const ny = Math.sin(a) * 0.7;
      const radius = r;
      const x = P.x + (N.x * nx + B.x * ny) * radius;
      const y = P.y + (N.y * nx + B.y * ny) * radius;
      const z = P.z + (N.z * nx + B.z * ny) * radius;
      positions.push(x, y, z);
      uvs.push(j / radial, t);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
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
  // Hoja en forma de almendra con leve curvatura.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.32, 0.1, 0.55, 0.5, 0.42, 0.95);
  shape.bezierCurveTo(0.32, 1.18, 0.12, 1.32, 0, 1.36);
  shape.bezierCurveTo(-0.12, 1.32, -0.32, 1.18, -0.42, 0.95);
  shape.bezierCurveTo(-0.55, 0.5, -0.32, 0.1, 0, 0);

  const geo = new THREE.ShapeGeometry(shape, 28);
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

  // UV ajustados al bounding box para que la textura no se pegue al origen.
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

export default function BeanModel() {
  const groupRef = useRef(null);

  const podGeo = useMemo(buildPodGeometry, []);
  const leafGeo = useMemo(buildLeafGeometry, []);
  const stemGeo = useMemo(buildStemGeometry, []);

  const podMap = useMemo(makePodColorTexture, []);
  const leafMap = useMemo(makeLeafColorTexture, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.015;
  });

  return (
    <group ref={groupRef} rotation={[0.05, 0, -0.1]} position={[0.05, 0, 0]}>
      {/* Vaina */}
      <mesh geometry={podGeo} castShadow receiveShadow>
        <meshStandardMaterial
          map={podMap}
          roughness={0.45}
          metalness={0.04}
        />
      </mesh>

      {/* Tallo */}
      <mesh geometry={stemGeo} castShadow receiveShadow>
        <meshStandardMaterial color="#65a30d" roughness={0.7} />
      </mesh>

      {/* Hojas trifoliadas */}
      <mesh
        geometry={leafGeo}
        position={[-POD_LENGTH / 2 - 0.42, 0.55, 0.02]}
        rotation={[0.4, 0.2, -0.5]}
        scale={0.6}
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
        position={[-POD_LENGTH / 2 - 0.34, 0.62, -0.18]}
        rotation={[0.5, -0.4, -0.2]}
        scale={0.5}
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
        position={[-POD_LENGTH / 2 - 0.5, 0.48, 0.22]}
        rotation={[0.3, 0.6, -0.7]}
        scale={0.55}
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
