import { useMemo } from 'react';
import * as THREE from 'three';

const POD_LENGTH = 2.05;
const POD_RADIUS = 0.158;

function buildPodGeometry() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2,  -0.08,  0),
    new THREE.Vector3(-POD_LENGTH / 4,   0.24,  0.07),
    new THREE.Vector3( 0,                0.30,  0),
    new THREE.Vector3( POD_LENGTH / 4,   0.24, -0.07),
    new THREE.Vector3( POD_LENGTH / 2,  -0.08,  0),
  ]);

  const segs   = 90;
  const radial = 22;
  const positions = [];
  const indices   = [];
  const uvs       = [];
  const frames = curve.computeFrenetFrames(segs, false);
  const points = curve.getSpacedPoints(segs);

  for (let i = 0; i <= segs; i++) {
    const t     = i / segs;
    const taper = Math.sin(t * Math.PI) * 0.80 + 0.20;
    // Gentle swells at each of the 7 bean pockets
    const swell = 1 + Math.sin(t * Math.PI * 7 * 2) * 0.14;
    const r     = POD_RADIUS * taper * swell;
    const N = frames.normals[Math.min(i, segs - 1)];
    const B = frames.binormals[Math.min(i, segs - 1)];
    const P = points[i];

    for (let j = 0; j < radial; j++) {
      const a  = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a);
      const ny = Math.sin(a) * 0.60; // flatten slightly
      positions.push(
        P.x + (N.x * nx + B.x * ny) * r,
        P.y + (N.y * nx + B.y * ny) * r,
        P.z + (N.z * nx + B.z * ny) * r,
      );
      uvs.push(j / radial, t);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b,  b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geometry: geo, curve };
}

// Single cowpea seed: cream body + dark "eye" mark
function BeanSeed({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <sphereGeometry args={[0.105, 20, 16]} />
        <meshPhysicalMaterial
          color="#f2e4b8"
          roughness={0.48}
          metalness={0}
          clearcoat={0.18}
          clearcoatRoughness={0.55}
        />
      </mesh>
      {/* Characteristic dark eye of the cowpea (frijol caupí) */}
      <mesh position={[0, 0, 0.096]}>
        <circleGeometry args={[0.034, 16]} />
        <meshStandardMaterial color="#321005" roughness={0.80} />
      </mesh>
    </group>
  );
}

function Pod({ geometry, curve }) {
  const beans = useMemo(() => {
    const count = 7;
    return Array.from({ length: count }, (_, i) => {
      const t   = (i + 0.60) / (count + 0.20);
      const p   = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const ang = Math.atan2(tan.x, tan.y) - Math.PI / 2;
      return {
        position: [p.x, p.y + 0.018, p.z],
        rotation: [Math.PI / 2, 0, -ang],
      };
    });
  }, [curve]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        {/* Clearcoat gives the pod a natural waxy, moist-looking surface */}
        <meshPhysicalMaterial
          color="#72b418"
          roughness={0.36}
          metalness={0}
          clearcoat={0.35}
          clearcoatRoughness={0.22}
          envMapIntensity={1.0}
        />
      </mesh>
      {beans.map((b, i) => (
        <BeanSeed key={i} position={b.position} rotation={b.rotation} />
      ))}
    </group>
  );
}

// One trifoliate node (3 leaflets) — matches the actual cowpea leaf structure
function TrifoliateLeaf({ position, rotation, scale = 1 }) {
  // Cowpea leaflet: ovate with a pointed tip and slightly heart-shaped base
  const leafGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo( 0.28, 0.08,  0.44, 0.36,  0.38, 0.66);
    shape.bezierCurveTo( 0.26, 0.90,  0.10, 1.02,  0,    1.08);
    shape.bezierCurveTo(-0.10, 1.02, -0.26, 0.90, -0.38, 0.66);
    shape.bezierCurveTo(-0.44, 0.36, -0.28, 0.08,  0,    0);
    const geo = new THREE.ShapeGeometry(shape, 22);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      pos.setZ(i, Math.sin(y * 1.9) * 0.072 + Math.cos(x * 2.4) * 0.038);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  const leafMat = (shade) => (
    <meshPhysicalMaterial
      color={shade}
      roughness={0.56}
      metalness={0}
      clearcoat={0.22}
      clearcoatRoughness={0.58}
      side={THREE.DoubleSide}
    />
  );

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Terminal (center) leaflet */}
      <mesh geometry={leafGeo} castShadow receiveShadow>
        {leafMat('#58a81e')}
      </mesh>
      {/* Left lateral leaflet */}
      <mesh
        geometry={leafGeo}
        position={[-0.44, -0.06, 0.02]}
        rotation={[0, 0, 0.32]}
        castShadow receiveShadow
      >
        {leafMat('#50a018')}
      </mesh>
      {/* Right lateral leaflet */}
      <mesh
        geometry={leafGeo}
        position={[0.44, -0.06, 0.02]}
        rotation={[0, 0, -0.32]}
        castShadow receiveShadow
      >
        {leafMat('#56aa1c')}
      </mesh>
    </group>
  );
}

function Stem() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-POD_LENGTH / 2 - 0.04, -0.08,  0),
        new THREE.Vector3(-POD_LENGTH / 2 - 0.22,  0.20,  0.04),
        new THREE.Vector3(-POD_LENGTH / 2 - 0.46,  0.52,  0),
      ]),
    [],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 14, 0.020, 8, false),
    [curve],
  );
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial color="#5a8818" roughness={0.78} clearcoat={0.10} />
    </mesh>
  );
}

export default function BeanModel() {
  const { geometry, curve } = useMemo(buildPodGeometry, []);
  const stemX = -POD_LENGTH / 2;

  return (
    <group rotation={[0.10, 0, -0.15]}>
      <Pod geometry={geometry} curve={curve} />
      <Stem />
      <TrifoliateLeaf
        position={[stemX - 0.50,  0.52,  0]}
        rotation={[0.35,  0.18, -0.55]}
        scale={0.54}
      />
      <TrifoliateLeaf
        position={[stemX - 0.40,  0.64, -0.22]}
        rotation={[0.45, -0.32, -0.28]}
        scale={0.44}
      />
    </group>
  );
}
