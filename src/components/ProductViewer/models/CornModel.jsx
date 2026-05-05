import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COB_HEIGHT = 1.9;
const COB_RADIUS = 0.38;
const KERNEL_ROWS = 26;
const KERNEL_COLS = 20;

function buildKernelGeometry() {
  const geo = new THREE.SphereGeometry(1, 14, 11);
  geo.scale(1.05, 1.38, 0.58);
  return geo;
}

// Husk leaf: hangs from cob base, fans outward and droops
function buildHuskLeaf() {
  const segs = 32;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs; // 0 = attachment (top), 1 = tip (bottom)
    const y = 0.28 - t * 2.1;

    // Width envelope: zero at top, peaks at t≈0.25, tapers to point
    const wEnv = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
    const w = 0.34 * Math.sin(wEnv * Math.PI * 0.95) + 0.008;

    // Radial outward spread (Z axis, becomes radial after Y rotation)
    const spread = 0.10 + Math.pow(t, 1.4) * 0.55;

    // Midrib slightly raised; edges cup inward toward cob
    const edgeDip = wEnv * 0.025;

    // Three vertices: left edge, midrib spine, right edge
    positions.push(-w, y, spread - edgeDip);
    positions.push(0,   y, spread + 0.04);
    positions.push( w, y, spread - edgeDip);

    uvs.push(0, t,  0.5, t,  1, t);
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 3, b = (i + 1) * 3;
    // left quad
    indices.push(a, b, a + 1,  a + 1, b, b + 1);
    // right quad
    indices.push(a + 1, b + 1, a + 2,  a + 2, b + 1, b + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function CobBase() {
  const geometry = useMemo(() => {
    const points = [];
    const segs = 28;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
      const taper =
        Math.sin(t * Math.PI) * 0.90 +
        0.10 -
        Math.max(0, (t - 0.90) * 5) ** 2 * 0.55;
      const r = COB_RADIUS * 0.83 * Math.max(0.04, taper);
      points.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(points, 40);
  }, []);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial color="#f0dda0" roughness={0.94} metalness={0} />
    </mesh>
  );
}

function Kernels() {
  const meshRef = useRef(null);
  const kernelGeo = useMemo(buildKernelGeometry, []);
  const count = KERNEL_ROWS * KERNEL_COLS;

  // Varied palette: deep amber → bright gold → warm orange-yellow
  const palette = useMemo(
    () => [
      new THREE.Color('#e8a010'),
      new THREE.Color('#f4c030'),
      new THREE.Color('#fad040'),
      new THREE.Color('#d49018'),
      new THREE.Color('#f8ce38'),
      new THREE.Color('#e09820'),
      new THREE.Color('#fce050'),
    ],
    [],
  );

  const { matrices, colors } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const matricesOut = [];
    const colorsOut = new Float32Array(count * 3);
    let idx = 0;

    for (let row = 0; row < KERNEL_ROWS; row++) {
      const t = row / (KERNEL_ROWS - 1);
      const y = -COB_HEIGHT / 2 + 0.09 + t * (COB_HEIGHT - 0.18);
      const taper = Math.sin(t * Math.PI) * 0.90 + 0.10;
      const radius = COB_RADIUS * Math.max(0.14, taper);
      if (t < 0.035 || t > 0.965) continue;

      for (let col = 0; col < KERNEL_COLS; col++) {
        const ang = (col / KERNEL_COLS) * Math.PI * 2 + row * 0.158;
        const x = Math.cos(ang) * radius;
        const z = Math.sin(ang) * radius;

        dummy.position.set(x, y, z);
        dummy.lookAt(x * 5, y, z * 5);
        dummy.rotateX(Math.PI / 2);
        const sc = 0.068 + Math.sin(t * Math.PI) * 0.018;
        dummy.scale.set(sc * 1.08, sc, sc * 0.80);
        dummy.updateMatrix();
        matricesOut.push(dummy.matrix.clone());

        const noise = Math.abs(Math.sin(row * 6.1 + col * 4.3 + 1.7));
        const cIdx = Math.floor(noise * palette.length) % palette.length;
        const c = palette[cIdx];
        colorsOut[idx * 3]     = c.r;
        colorsOut[idx * 3 + 1] = c.g;
        colorsOut[idx * 3 + 2] = c.b;
        idx++;
      }
    }
    return { matrices: matricesOut, colors: colorsOut.slice(0, idx * 3) };
  }, [count, palette]);

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
      {/* Clearcoat simulates the waxy sheen of fresh corn kernels */}
      <meshPhysicalMaterial
        color="#f4c030"
        roughness={0.16}
        metalness={0}
        clearcoat={0.60}
        clearcoatRoughness={0.22}
        envMapIntensity={1.5}
      />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
}

function Husks() {
  const huskGeo = useMemo(buildHuskLeaf, []);

  const huskData = useMemo(() => {
    const count = 9;
    const huskPalette = [
      '#4d7c1a', '#3d6b14', '#5a8c22', '#466e16',
      '#527a1c', '#3a6010', '#4e7e1c', '#426514', '#54861e',
    ];
    return Array.from({ length: count }, (_, i) => {
      const ang = (i / count) * Math.PI * 2;
      return {
        // All husks originate near cob base; Y rotation fans them around
        position: [0, -COB_HEIGHT * 0.10, 0],
        rotation: [Math.sin(i * 2.1) * 0.06, ang, 0],
        scale: [1, 0.96 + (i % 3) * 0.06, 1],
        color: huskPalette[i % huskPalette.length],
      };
    });
  }, []);

  return (
    <group>
      {huskData.map((h, i) => (
        <mesh
          key={i}
          geometry={huskGeo}
          position={h.position}
          rotation={h.rotation}
          scale={h.scale}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color={h.color}
            roughness={0.82}
            metalness={0}
            clearcoat={0.06}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Stalk() {
  // Short green stalk visible below the husks
  const geometry = useMemo(
    () => new THREE.CylinderGeometry(0.052, 0.068, 0.52, 14),
    [],
  );
  return (
    <mesh
      geometry={geometry}
      position={[0, -COB_HEIGHT / 2 - 0.30, 0]}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial color="#4a6820" roughness={0.87} clearcoat={0.06} />
    </mesh>
  );
}

function Silk() {
  const strands = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => {
      const ang = (i / 48) * Math.PI * 2;
      const r = 0.032 + (i % 6) * 0.018;
      return {
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        len: 0.18 + (i % 7) * 0.06,
        tilt: 0.20 + (i % 5) * 0.09,
      };
    });
  }, []);

  return (
    <group position={[0, COB_HEIGHT / 2 - 0.02, 0]}>
      {strands.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.len / 2, s.z]}
          rotation={[
            s.tilt * Math.sin(i * 0.62),
            i * 0.42,
            s.tilt * Math.cos(i * 0.62),
          ]}
        >
          <cylinderGeometry args={[0.0028, 0.001, s.len, 3]} />
          <meshStandardMaterial color="#d8b840" roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

export default function CornModel() {
  return (
    <group position={[0, 0.28, 0]}>
      <CobBase />
      <Kernels />
      <Husks />
      <Stalk />
      <Silk />
    </group>
  );
}
