import { useMemo } from 'react';
import * as THREE from 'three';

const POD_LENGTH = 1.9;
const POD_RADIUS = 0.18;

function buildPodGeometry() {
  // Curved pod via custom tube along a quadratic curve
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-POD_LENGTH / 2, -0.05, 0),
    new THREE.Vector3(-POD_LENGTH / 4, 0.18, 0.05),
    new THREE.Vector3(0, 0.22, 0),
    new THREE.Vector3(POD_LENGTH / 4, 0.18, -0.05),
    new THREE.Vector3(POD_LENGTH / 2, -0.05, 0),
  ]);

  const segs = 64;
  const radial = 18;
  // Custom tube with variable radius (taper at tips, bulges at beans)
  const positions = [];
  const indices = [];
  const uvs = [];
  const frames = curve.computeFrenetFrames(segs, false);
  const points = curve.getSpacedPoints(segs);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const taper = Math.sin(t * Math.PI) * 0.85 + 0.15;
    // bumps where beans are
    const bumps = 1 + Math.sin(t * Math.PI * 6) * 0.12;
    const r = POD_RADIUS * taper * bumps;
    const N = frames.normals[Math.min(i, segs - 1)];
    const B = frames.binormals[Math.min(i, segs - 1)];
    const P = points[i];

    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // squash horizontally so the pod is flatter
      const nx = Math.cos(a);
      const ny = Math.sin(a) * 0.65;
      const x = P.x + (N.x * nx + B.x * ny) * r;
      const y = P.y + (N.y * nx + B.y * ny) * r;
      const z = P.z + (N.z * nx + B.z * ny) * r;
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
  return { geometry: geo, curve };
}

function BeanInside({ position, rotation }) {
  // Single cowpea bean: cream colored with dark "eye"
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <sphereGeometry args={[0.13, 24, 18]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* the dark "eye" characteristic of cowpea */}
      <mesh position={[0, 0, 0.115]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.045, 18]} />
        <meshStandardMaterial color="#451a03" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Pod({ geometry, curve }) {
  // place beans along the curve, slightly above to be visible
  const beans = useMemo(() => {
    const arr = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const t = (i + 0.7) / (count + 0.4);
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const angle = Math.atan2(tan.x, tan.y) - Math.PI / 2;
      arr.push({
        position: [p.x, p.y + 0.02, p.z],
        rotation: [Math.PI / 2, 0, -angle],
      });
    }
    return arr;
  }, [curve]);

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#84cc16"
          roughness={0.45}
          metalness={0.05}
          envMapIntensity={0.8}
        />
      </mesh>
      {beans.map((b, i) => (
        <BeanInside key={i} position={b.position} rotation={b.rotation} />
      ))}
    </group>
  );
}

function Leaf({ position, rotation, scale = 1 }) {
  // Trifoliate leaflet shape via custom geometry
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.25, 0.05, 0.45, 0.4, 0.4, 0.7);
    shape.bezierCurveTo(0.3, 0.95, 0.1, 1.05, 0, 1.1);
    shape.bezierCurveTo(-0.1, 1.05, -0.3, 0.95, -0.4, 0.7);
    shape.bezierCurveTo(-0.45, 0.4, -0.25, 0.05, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 16);
    // add subtle bend by tweaking z based on y
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(y * 1.4) * 0.08);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh
      geometry={geometry}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color="#4ade80"
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Stem() {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-POD_LENGTH / 2 - 0.05, -0.05, 0),
        new THREE.Vector3(-POD_LENGTH / 2 - 0.25, 0.15, 0.05),
        new THREE.Vector3(-POD_LENGTH / 2 - 0.45, 0.45, 0),
      ]),
    [],
  );
  const geometry = useMemo(
    () => new THREE.TubeGeometry(curve, 16, 0.025, 8, false),
    [curve],
  );

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#65a30d" roughness={0.7} />
    </mesh>
  );
}

export default function BeanModel() {
  const { geometry, curve } = useMemo(buildPodGeometry, []);

  return (
    <group rotation={[0.1, 0, -0.15]}>
      <Pod geometry={geometry} curve={curve} />
      <Stem />
      <Leaf
        position={[-POD_LENGTH / 2 - 0.5, 0.45, 0]}
        rotation={[0.4, 0.2, -0.5]}
        scale={0.55}
      />
      <Leaf
        position={[-POD_LENGTH / 2 - 0.45, 0.55, -0.2]}
        rotation={[0.5, -0.4, -0.2]}
        scale={0.45}
      />
      <Leaf
        position={[-POD_LENGTH / 2 - 0.55, 0.4, 0.18]}
        rotation={[0.3, 0.6, -0.7]}
        scale={0.5}
      />
    </group>
  );
}
