import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COB_HEIGHT = 1.7;
const COB_RADIUS = 0.42;
const KERNEL_ROWS = 22;
const KERNEL_COLS = 18;

function buildKernelGeometry() {
  const geo = new THREE.SphereGeometry(1, 12, 10);
  geo.scale(1, 1.25, 0.55);
  return geo;
}

function buildHuskGeometry() {
  const length = 1.6;
  const width = 0.45;
  const segs = 24;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -length * 0.55 + t * length;
    const taper = Math.sin(t * Math.PI) * 0.85 + 0.15;
    const curl = Math.sin(t * Math.PI * 0.9) * 0.18;
    const w = width * taper;
    positions.push(-w, y, curl);
    positions.push(w, y, curl + 0.04);
    uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2);
    indices.push(a + 1, a + 3, a + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function CobBase() {
  // Cob core via lathe so the silhouette is rounded, not a plain cylinder
  const geometry = useMemo(() => {
    const points = [];
    const segs = 20;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
      // taper at the tips
      const taper =
        Math.sin(t * Math.PI) * 0.92 +
        0.08 -
        Math.max(0, (t - 0.92) * 4) ** 2 * 0.4;
      const r = COB_RADIUS * 0.78 * Math.max(0.05, taper);
      points.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(points, 32);
  }, []);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#fef3c7" roughness={0.9} metalness={0} />
    </mesh>
  );
}

function Kernels() {
  const meshRef = useRef(null);
  const kernelGeo = useMemo(buildKernelGeometry, []);
  const count = KERNEL_ROWS * KERNEL_COLS;

  // Color palette: amber to gold with subtle variation
  const palette = useMemo(
    () => [
      new THREE.Color('#facc15'),
      new THREE.Color('#eab308'),
      new THREE.Color('#fde047'),
      new THREE.Color('#f59e0b'),
      new THREE.Color('#fcd34d'),
    ],
    [],
  );

  const { matrices, colors } = useMemo(() => {
    const m = new THREE.Matrix4();
    const dummy = new THREE.Object3D();
    const matricesOut = [];
    const colorsOut = new Float32Array(count * 3);
    let idx = 0;

    for (let row = 0; row < KERNEL_ROWS; row++) {
      const t = row / (KERNEL_ROWS - 1);
      const y = -COB_HEIGHT / 2 + 0.12 + t * (COB_HEIGHT - 0.24);
      const taper = Math.sin(t * Math.PI) * 0.92 + 0.08;
      const radius = COB_RADIUS * Math.max(0.18, taper);
      // skip the very tip rows (no kernels at the pointy ends)
      if (t < 0.05 || t > 0.95) continue;

      for (let col = 0; col < KERNEL_COLS; col++) {
        const ang = (col / KERNEL_COLS) * Math.PI * 2 + row * 0.18; // spiral offset
        const x = Math.cos(ang) * radius;
        const z = Math.sin(ang) * radius;

        dummy.position.set(x, y, z);
        // orient kernel outward
        dummy.lookAt(x * 3, y, z * 3);
        dummy.rotateX(Math.PI / 2);
        const scale = 0.085 + Math.sin(t * Math.PI) * 0.025;
        dummy.scale.set(scale, scale, scale * 0.85);
        dummy.updateMatrix();
        matricesOut.push(dummy.matrix.clone());

        const c = palette[(row + col) % palette.length];
        colorsOut[idx * 3] = c.r;
        colorsOut[idx * 3 + 1] = c.g;
        colorsOut[idx * 3 + 2] = c.b;
        idx++;
      }
    }
    return { matrices: matricesOut, colors: colorsOut.slice(0, idx * 3) };
  }, [count, palette]);

  // Apply matrices once
  useFrame(() => {
    if (!meshRef.current) return;
    const inst = meshRef.current;
    if (inst.userData._initialized) return;
    matrices.forEach((mat, i) => inst.setMatrixAt(i, mat));
    inst.instanceMatrix.needsUpdate = true;
    inst.userData._initialized = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[kernelGeo, undefined, matrices.length]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors={false}
        color="#facc15"
        roughness={0.35}
        metalness={0.05}
        envMapIntensity={0.7}
      />
      <instancedBufferAttribute
        attach="instanceColor"
        args={[colors, 3]}
      />
    </instancedMesh>
  );
}

function Husks() {
  const huskGeo = useMemo(buildHuskGeometry, []);
  const husks = useMemo(() => {
    const arr = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      arr.push({
        position: [
          Math.cos(ang) * (COB_RADIUS * 0.55),
          -COB_HEIGHT * 0.18,
          Math.sin(ang) * (COB_RADIUS * 0.55),
        ],
        rotation: [0.18, ang + Math.PI / 2, -0.05 + Math.sin(i) * 0.1],
        scale: 0.85 + (i % 2) * 0.18,
        color: i % 2 === 0 ? '#65a30d' : '#4d7c0f',
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {husks.map((h, i) => (
        <mesh
          key={i}
          geometry={huskGeo}
          position={h.position}
          rotation={h.rotation}
          scale={h.scale}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={h.color}
            roughness={0.75}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Silk() {
  // Corn silk strands at the top
  const strands = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2;
      const r = 0.05 + (i % 3) * 0.03;
      arr.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        len: 0.18 + (i % 4) * 0.06,
        tilt: 0.3 + (i % 3) * 0.15,
      });
    }
    return arr;
  }, []);

  return (
    <group position={[0, COB_HEIGHT / 2 - 0.05, 0]}>
      {strands.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.len / 2, s.z]}
          rotation={[s.tilt * Math.sin(i), i, s.tilt * Math.cos(i)]}
        >
          <cylinderGeometry args={[0.005, 0.003, s.len, 4]} />
          <meshStandardMaterial color="#fde68a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function CornModel() {
  return (
    <group>
      <CobBase />
      <Kernels />
      <Husks />
      <Silk />
    </group>
  );
}
