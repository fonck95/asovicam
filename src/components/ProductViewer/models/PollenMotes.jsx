import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// =====================================================
// PollenMotes — small atmospheric particles floating around
// a model. Cheap: a single Points object with an additive
// material that we offset on every frame via a vertex buffer.
// Use to add life to corn (pollen), beans (dust) and the
// watermelon scene (juice sparkle). One draw call, no lights.
// =====================================================

export default function PollenMotes({
  count = 24,
  radius = 1.2,
  height = 2.0,
  color = '#fff4c2',
  size = 0.02,
  speed = 0.4,
  opacity = 0.85,
}) {
  const pointsRef = useRef(null);

  // Pre-bake per-particle parameters: birth position, drift amplitude
  // and phase. The animation reads these and writes the position buffer
  // each frame. Keeping the heavy random work outside useFrame means
  // we only pay 1 sin/cos per particle per frame at runtime.
  const { positions, basis } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const data = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = radius * (0.35 + Math.random() * 0.65);
      const y = (Math.random() - 0.35) * height;
      const ax = 0.05 + Math.random() * 0.08;
      const ay = 0.06 + Math.random() * 0.12;
      const phase = Math.random() * Math.PI * 2;
      const speedJitter = 0.7 + Math.random() * 0.6;
      pos[i * 3 + 0] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r;
      data[i * 6 + 0] = Math.cos(theta) * r;
      data[i * 6 + 1] = y;
      data[i * 6 + 2] = Math.sin(theta) * r;
      data[i * 6 + 3] = ax;
      data[i * 6 + 4] = ay;
      data[i * 6 + 5] = phase + speedJitter; // packed phase + speed
    }
    return { positions: pos, basis: data };
  }, [count, radius, height]);

  // Soft round sprite — a single radial-gradient texture so each point
  // looks like a glowing mote instead of a hard pixel.
  const sprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points) return;
    const t = clock.elapsedTime * speed;
    const attr = points.geometry.attributes.position;
    const arr = attr.array;
    for (let i = 0; i < count; i++) {
      const ox = basis[i * 6 + 0];
      const oy = basis[i * 6 + 1];
      const oz = basis[i * 6 + 2];
      const ax = basis[i * 6 + 3];
      const ay = basis[i * 6 + 4];
      const ph = basis[i * 6 + 5];
      arr[i * 3 + 0] = ox + Math.sin(t + ph) * ax;
      arr[i * 3 + 1] = oy + Math.cos(t * 0.8 + ph * 1.3) * ay;
      arr[i * 3 + 2] = oz + Math.sin(t * 0.7 + ph * 0.6) * ax;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        sizeAttenuation
        color={color}
        map={sprite}
        alphaMap={sprite}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
