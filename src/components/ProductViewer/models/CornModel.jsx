import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COB_HEIGHT = 1.75;
const COB_RADIUS = 0.46;
const KERNEL_ROWS = 30;
const KERNEL_COLS = 22;

// Kernel geometry: rounded "tooth" shape (slightly squared, bulging outward).
function buildKernelGeometry() {
  const geo = new THREE.SphereGeometry(1, 16, 14);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Squarer profile: pull verts towards the cardinal axes
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    v.x = Math.sign(v.x) * Math.pow(ax, 0.78);
    v.y = Math.sign(v.y) * Math.pow(ay, 0.85);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.scale(1, 1.18, 0.55);
  return geo;
}

// Husk geometry: long curved leaf with central rib and natural taper.
function buildHuskGeometry() {
  const length = 1.85;
  const width = 0.55;
  const lengthSegs = 32;
  const widthSegs = 6;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const y = -length * 0.5 + t * length;
    // taper: pinch at base and tip
    const taper =
      Math.sin(Math.pow(t, 0.85) * Math.PI) * 0.85 +
      0.15 -
      Math.max(0, (t - 0.92) * 4) ** 2 * 0.45;
    // gentle longitudinal curl + extra forward fold near tip
    const curlZ = Math.sin(t * Math.PI * 0.9) * 0.18 + Math.pow(t, 2.2) * 0.18;

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const xRaw = (u - 0.5) * 2; // -1..1
      const w = width * Math.max(0.03, taper);
      const x = xRaw * w;
      // central rib bulge
      const rib = (1 - Math.abs(xRaw)) * 0.05;
      // wavy edge
      const wave = Math.sin(t * 14) * 0.012 * Math.abs(xRaw);
      const z = curlZ + rib + wave;
      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  const cols = widthSegs + 1;
  for (let i = 0; i < lengthSegs; i++) {
    for (let j = 0; j < widthSegs; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
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

// Husk material with longitudinal veining baked into the fragment shader.
function useHuskMaterial(baseColor) {
  return useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    // USE_UV hace que three.js declare `vUv` (varying) y la asigne en el
    // vertex shader; sin esto, MeshStandardMaterial no tiene `vUv` cuando
    // no hay textura mapeada y el shader inyectado falla al compilar.
    mat.defines = { ...(mat.defines || {}), USE_UV: '' };
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
          #include <color_fragment>
          // Vertical veins along the husk; vUv.x is across the leaf
          float v = vUv.x;
          float rib = smoothstep(0.45, 0.5, v) - smoothstep(0.5, 0.55, v);
          float veins = abs(sin(v * 24.0 + sin(vUv.y * 6.0) * 0.8));
          veins = smoothstep(0.85, 1.0, veins);
          // shading: brighter at center rib, slightly darker at edges
          float edgeShade = mix(0.78, 1.05, smoothstep(0.0, 0.45, v) - smoothstep(0.55, 1.0, v));
          diffuseColor.rgb *= edgeShade;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7, veins * 0.55);
          diffuseColor.rgb += rib * 0.06;
        `,
      );
    };
    return mat;
  }, [baseColor]);
}

function CobBase() {
  // Cob core via lathe so the silhouette is rounded with subtle row bumps.
  const geometry = useMemo(() => {
    const points = [];
    const segs = 28;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
      const taper =
        Math.sin(t * Math.PI) * 0.94 +
        0.06 -
        Math.max(0, (t - 0.93) * 4) ** 2 * 0.45;
      const r = COB_RADIUS * 0.74 * Math.max(0.03, taper);
      points.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(points, 40);
  }, []);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#fde68a"
        roughness={0.92}
        metalness={0}
        emissive="#451a03"
        emissiveIntensity={0.04}
      />
    </mesh>
  );
}

function Kernels() {
  const meshRef = useRef(null);
  const kernelGeo = useMemo(buildKernelGeometry, []);
  const count = KERNEL_ROWS * KERNEL_COLS;

  // Realistic palette: rich amber/gold core with sporadic deeper amber and
  // pale-yellow kernels for natural variation, no two kernels exactly alike.
  const palette = useMemo(
    () => [
      new THREE.Color('#fcd34d'),
      new THREE.Color('#f59e0b'),
      new THREE.Color('#eab308'),
      new THREE.Color('#fde68a'),
      new THREE.Color('#fbbf24'),
      new THREE.Color('#d97706'),
      new THREE.Color('#fef3c7'), // pale highlights
    ],
    [],
  );

  const { matrices, colors, total } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const matricesOut = [];
    const colorsOut = [];

    for (let row = 0; row < KERNEL_ROWS; row++) {
      const t = row / (KERNEL_ROWS - 1);
      const y = -COB_HEIGHT / 2 + 0.1 + t * (COB_HEIGHT - 0.2);
      const taper = Math.sin(t * Math.PI) * 0.94 + 0.06;
      const radius = COB_RADIUS * Math.max(0.16, taper);
      // Skip the very tip rows (no kernels at the pointy ends)
      if (t < 0.04 || t > 0.96) continue;

      for (let col = 0; col < KERNEL_COLS; col++) {
        // spiral offset = corn rows are slightly twisted around the cob
        const ang = (col / KERNEL_COLS) * Math.PI * 2 + row * 0.16;
        // jitter for organic packing
        const jitterAng = (Math.sin(row * 1.7 + col * 2.3) * 0.5 - 0.25) * 0.04;
        const jitterY = Math.sin(row * 3.1 + col * 1.9) * 0.005;
        const a = ang + jitterAng;

        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;

        dummy.position.set(x, y + jitterY, z);
        dummy.lookAt(x * 4, y + jitterY, z * 4);
        dummy.rotateX(Math.PI / 2);
        // small random rotation around the kernel's normal
        dummy.rotateY((Math.sin(row * col) * 0.2));
        // size: bigger in the middle of the cob, smaller at tips
        const sizeProfile = 0.085 + Math.sin(t * Math.PI) * 0.028;
        // gentle per-kernel random scaling
        const variance = 0.92 + ((row * 7 + col * 13) % 17) / 100;
        const sx = sizeProfile * variance;
        const sy = sizeProfile * variance * 1.05;
        const sz = sizeProfile * variance * 0.9;
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        matricesOut.push(dummy.matrix.clone());

        // Pick a color, biased towards the central golds. Add a tiny chance of a
        // pale "milk" kernel near the tips for that real-corn variation.
        const rand = (row * 31 + col * 17) % 100;
        let c;
        if (t > 0.85 && rand < 10) c = palette[6];
        else if (rand < 12) c = palette[5];
        else if (rand < 30) c = palette[1];
        else if (rand < 55) c = palette[0];
        else if (rand < 75) c = palette[2];
        else if (rand < 90) c = palette[4];
        else c = palette[3];
        colorsOut.push(c.r, c.g, c.b);
      }
    }
    return {
      matrices: matricesOut,
      colors: new Float32Array(colorsOut),
      total: matricesOut.length,
    };
  }, [count, palette]);

  // Apply matrices and colors once on mount
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
      args={[kernelGeo, undefined, total]}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial
        color="#facc15"
        roughness={0.28}
        metalness={0.02}
        clearcoat={0.55}
        clearcoatRoughness={0.35}
        sheen={0.2}
        sheenColor="#fef3c7"
        envMapIntensity={1.0}
      />
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
    </instancedMesh>
  );
}

function Husks() {
  const huskGeo = useMemo(buildHuskGeometry, []);
  // Two outer-husk materials with different greens for natural variation.
  const matLight = useHuskMaterial('#84cc16');
  const matMid = useHuskMaterial('#65a30d');
  const matDark = useHuskMaterial('#4d7c0f');
  const matDried = useHuskMaterial('#a3a380');

  // Two layers of husks: an inner tight wrap and an outer flared layer.
  const innerHusks = useMemo(() => {
    const arr = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      arr.push({
        position: [
          Math.cos(ang) * COB_RADIUS * 0.62,
          -COB_HEIGHT * 0.15,
          Math.sin(ang) * COB_RADIUS * 0.62,
        ],
        rotation: [0.08, ang + Math.PI / 2, -0.04 + Math.sin(i) * 0.06],
        scale: 0.9 + (i % 2) * 0.1,
        kind: i % 3 === 0 ? 'mid' : i % 3 === 1 ? 'dark' : 'light',
      });
    }
    return arr;
  }, []);

  const outerHusks = useMemo(() => {
    const arr = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + 0.4;
      arr.push({
        position: [
          Math.cos(ang) * COB_RADIUS * 0.78,
          -COB_HEIGHT * 0.32,
          Math.sin(ang) * COB_RADIUS * 0.78,
        ],
        // outer husks flare outward and arch back slightly
        rotation: [0.32, ang + Math.PI / 2, -0.18 + Math.cos(i) * 0.18],
        scale: 1.05 + (i % 2) * 0.18,
        kind: i % 4 === 0 ? 'dried' : i % 2 === 0 ? 'light' : 'mid',
      });
    }
    return arr;
  }, []);

  const matFor = (k) =>
    k === 'light' ? matLight : k === 'dark' ? matDark : k === 'dried' ? matDried : matMid;

  return (
    <group>
      {innerHusks.map((h, i) => (
        <mesh
          key={`in-${i}`}
          geometry={huskGeo}
          material={matFor(h.kind)}
          position={h.position}
          rotation={h.rotation}
          scale={h.scale}
          castShadow
          receiveShadow
        />
      ))}
      {outerHusks.map((h, i) => (
        <mesh
          key={`out-${i}`}
          geometry={huskGeo}
          material={matFor(h.kind)}
          position={h.position}
          rotation={h.rotation}
          scale={h.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function Silk() {
  // Corn silk strands at the top — many fine drooping fibers.
  const strands = useMemo(() => {
    const arr = [];
    const count = 60;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.sin(i) * 0.4;
      const r = 0.04 + (i % 5) * 0.022;
      arr.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        len: 0.22 + (i % 6) * 0.06,
        tilt: 0.4 + (i % 4) * 0.16,
        seed: i,
      });
    }
    return arr;
  }, []);

  return (
    <group position={[0, COB_HEIGHT / 2 - 0.04, 0]}>
      {strands.map((s, i) => {
        const tx = Math.sin(s.seed * 1.7) * s.tilt * 0.6;
        const tz = Math.cos(s.seed * 2.1) * s.tilt * 0.6;
        const droop = -s.tilt * 0.3;
        return (
          <mesh
            key={i}
            position={[s.x + tx * 0.05, s.len / 2, s.z + tz * 0.05]}
            rotation={[droop * Math.cos(s.seed), s.seed, droop * Math.sin(s.seed)]}
          >
            <cylinderGeometry args={[0.0035, 0.0018, s.len, 4]} />
            <meshStandardMaterial
              color={i % 4 === 0 ? '#fcd34d' : '#fde68a'}
              roughness={0.9}
              transparent
              opacity={0.95}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function CornModel() {
  return (
    <group rotation={[0, 0.2, 0]}>
      <CobBase />
      <Kernels />
      <Husks />
      <Silk />
    </group>
  );
}
