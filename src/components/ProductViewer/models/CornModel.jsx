import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  makeCornBumpTexture,
  makeCornColorTexture,
  makeHuskColorTexture,
} from '../textures';

// =====================================================
// Maíz: una mazorca como cilindro fuselado, con textura
// procedural de granos en canvas (color + bump map). Sin
// shaders inyectados, sin instancedMesh con cientos de
// items. Dos hojas envolventes en la base.
// =====================================================

const COB_HEIGHT = 1.7;
const COB_RADIUS = 0.46;

function buildCobGeometry() {
  // Cilindro segmentado con perfil afilado a las puntas (lathe).
  const points = [];
  const segs = 28;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = -COB_HEIGHT / 2 + t * COB_HEIGHT;
    // Taper en ambos extremos para que la mazorca se afile.
    const taper =
      Math.sin(Math.pow(t, 0.92) * Math.PI) * 0.96 +
      0.04 -
      Math.max(0, (t - 0.94) * 8) ** 2 * 0.4;
    points.push(new THREE.Vector2(COB_RADIUS * Math.max(0.04, taper), y));
  }
  return new THREE.LatheGeometry(points, 64);
}

function buildHuskGeometry() {
  // Hoja larga con curva suave hacia adelante.
  const length = 1.55;
  const width = 0.45;
  const lengthSegs = 24;
  const widthSegs = 6;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const t = i / lengthSegs;
    const y = -length * 0.05 + t * length;
    const taper =
      Math.sin(Math.pow(t, 0.85) * Math.PI) * 0.85 +
      0.15 -
      Math.max(0, (t - 0.92) * 4) ** 2 * 0.45;
    const curlZ = Math.sin(t * Math.PI * 0.85) * 0.18 + Math.pow(t, 2) * 0.18;

    for (let j = 0; j <= widthSegs; j++) {
      const u = j / widthSegs;
      const xRaw = (u - 0.5) * 2;
      const w = width * Math.max(0.04, taper);
      const x = xRaw * w;
      const rib = (1 - Math.abs(xRaw)) * 0.05;
      positions.push(x, y, curlZ + rib);
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

export default function CornModel() {
  const groupRef = useRef(null);

  const cobGeometry = useMemo(buildCobGeometry, []);
  const huskGeometry = useMemo(buildHuskGeometry, []);

  const cornColor = useMemo(makeCornColorTexture, []);
  const cornBump = useMemo(makeCornBumpTexture, []);
  const huskColor = useMemo(makeHuskColorTexture, []);

  // Pequeña entrada en escena: levitación + giro.
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.02;
  });

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}>
      {/* Mazorca */}
      <mesh geometry={cobGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={cornColor}
          bumpMap={cornBump}
          bumpScale={0.025}
          roughness={0.45}
          metalness={0.04}
        />
      </mesh>

      {/* Hojas (husks) en la base */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + 0.2;
        const tilt = 0.18 + (i % 2) * 0.05;
        const scale = 1 + (i % 2) * 0.08;
        return (
          <mesh
            key={i}
            geometry={huskGeometry}
            position={[
              Math.cos(angle) * COB_RADIUS * 0.7,
              -COB_HEIGHT * 0.45,
              Math.sin(angle) * COB_RADIUS * 0.7,
            ]}
            rotation={[tilt, angle + Math.PI / 2, 0]}
            scale={scale}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              map={huskColor}
              roughness={0.78}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}
