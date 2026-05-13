import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import CornModel from '../ProductViewer/models/CornModel';
import BeanModel from '../ProductViewer/models/BeanModel';
import WatermelonModel from '../ProductViewer/models/WatermelonModel';
import styles from './HeroCrop3D.module.css';

// =====================================================
// HeroCrop3D — the marketing centerpiece.
//
// A small free-floating 3D model placed inside the hero,
// not in a "section" but layered with the hero gradient.
// It cycles through corn → bean → watermelon and tilts
// gently toward the pointer to feel alive and inviting.
//
// Performance:
//   - dpr capped at 1.5 (visual quality is still high because
//     the hero canvas is small)
//   - shadows disabled (we use a soft <ContactShadows>)
//   - IntersectionObserver gates the canvas: when the hero
//     scrolls out of view we drop the frameloop to "never"
//     and skip every WebGL frame entirely.
// =====================================================

type CropKey = 'maiz' | 'frijol' | 'sandia';

const CROPS: { key: CropKey; label: string; tagline: string; accent: string }[] = [
  {
    key: 'maiz',
    label: 'Maíz criollo',
    tagline: 'El pilar vertical de la milpa',
    accent: '#f59e0b',
  },
  {
    key: 'frijol',
    label: 'Frijol caupí',
    tagline: 'Fija nitrógeno · alimenta el suelo',
    accent: '#22c55e',
  },
  {
    key: 'sandia',
    label: 'Sandía',
    tagline: 'Tapiza el suelo · retiene humedad',
    accent: '#ef4444',
  },
];

function Crop({ id }: { id: CropKey }) {
  if (id === 'frijol') return <BeanModel />;
  if (id === 'sandia') return <WatermelonModel />;
  return <CornModel />;
}

interface Pointer {
  current: { x: number; y: number };
}

function Rig({ pointer }: { pointer: Pointer }) {
  // Smoothly lerps the camera toward the pointer-offset for a subtle,
  // cinema-grade parallax. Keep amplitudes small so the model still
  // reads as a product render and not a wobble. Smoothed values live in
  // local refs so we never mutate the parent's ref-object props.
  const tx = useRef(0);
  const ty = useRef(0);
  useFrame((state, dt) => {
    const k = Math.min(1, dt * 4.5);
    tx.current += (pointer.current.x - tx.current) * k;
    ty.current += (pointer.current.y - ty.current) * k;
    const { camera } = state;
    const baseX = 3.2;
    const baseY = 1.6;
    const baseZ = 3.6;
    camera.position.x = baseX + tx.current * 0.6;
    camera.position.y = baseY + ty.current * 0.35;
    camera.position.z = baseZ - Math.abs(tx.current) * 0.15;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function AutoSpin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.35;
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroCrop3D() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % CROPS.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, []);

  // Pause WebGL when the hero is off-screen — saves battery on long
  // homepage scrolls.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    pointer.current.x = (px - 0.5) * 2;
    pointer.current.y = (py - 0.5) * -2;
  };

  const onPointerLeave = () => {
    pointer.current.x = 0;
    pointer.current.y = 0;
  };

  const active = CROPS[activeIdx];

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      style={{ ['--accent' as string]: active.accent }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      aria-hidden="true"
    >
      <div className={styles.halo} />
      <div className={styles.ring} />

      <div className={styles.canvasHolder}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [3.2, 1.6, 3.6], fov: 32 }}
          frameloop={visible ? 'always' : 'never'}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
            outputColorSpace: THREE.SRGBColorSpace,
            alpha: true,
            powerPreference: 'high-performance',
          }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} color="#ffffff" />
            <hemisphereLight args={['#fff5d6', '#0a2415', 0.45]} />
            <directionalLight position={[4, 5, 3]} intensity={1.8} color="#fff5dc" />
            <directionalLight position={[-4, 2, -2]} intensity={0.4} color="#bbf7d0" />
            <pointLight position={[1.5, 1.2, 4]} intensity={0.55} color="#fffde7" />

            <Environment preset="apartment" environmentIntensity={0.8} />

            <Rig pointer={pointer} />

            <group key={active.key} position={[0, -0.1, 0]} scale={0.95}>
              <AutoSpin>
                <Crop id={active.key} />
              </AutoSpin>
            </group>

            <ContactShadows
              position={[0, -1.05, 0]}
              opacity={0.5}
              scale={5}
              blur={2.6}
              far={2.2}
              resolution={1024}
              color="#0a1a05"
            />
          </Suspense>
        </Canvas>
      </div>

      <div className={styles.caption}>
        <span className={styles.captionDot} />
        <span className={styles.captionLabel}>{active.label}</span>
        <span className={styles.captionTagline}>{active.tagline}</span>
      </div>

      <div className={styles.indicators} aria-hidden="true">
        {CROPS.map((c, i) => (
          <span
            key={c.key}
            className={`${styles.indicator} ${i === activeIdx ? styles.indicatorActive : ''}`}
            style={{ ['--dot' as string]: c.accent }}
          />
        ))}
      </div>
    </div>
  );
}
