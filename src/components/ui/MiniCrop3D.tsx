import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import CornModel from '../ProductViewer/models/CornModel';
import BeanModel from '../ProductViewer/models/BeanModel';
import WatermelonModel from '../ProductViewer/models/WatermelonModel';
import styles from './MiniCrop3D.module.css';

// =====================================================
// MiniCrop3D — a tiny 3D model used as an icon.
//
// Drops into card layouts as a replacement for an emoji
// or SVG. Always auto-spins; on parent hover it speeds up
// (controlled via the `accelerate` prop). Each instance is
// gated by IntersectionObserver so cards far down the page
// don't burn a WebGL context until they enter the viewport.
// =====================================================

type CropKey = 'maiz' | 'frijol' | 'sandia' | 'frijol-caupi';

interface Props {
  id: CropKey;
  accelerate?: boolean;
  size?: number;
  className?: string;
}

function MiniModel({ id }: { id: CropKey }) {
  // Each model has its own natural scale — we shrink + center so they
  // all fit the same square frame.
  if (id === 'frijol' || id === 'frijol-caupi') {
    return (
      <group scale={0.9} position={[0, 0.05, 0]} rotation={[0.1, 0, 0]}>
        <BeanModel />
      </group>
    );
  }
  if (id === 'sandia') {
    return (
      <group scale={0.7} position={[-0.25, -0.05, 0]} rotation={[0.05, 0, 0]}>
        <WatermelonModel />
      </group>
    );
  }
  return (
    <group scale={0.78} position={[0, -0.05, 0]}>
      <CornModel />
    </group>
  );
}

function Spinner({
  accelerate,
  children,
}: {
  accelerate: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const speedRef = useRef(0.55);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = accelerate ? 1.6 : 0.55;
    speedRef.current += (target - speedRef.current) * Math.min(1, dt * 4.5);
    ref.current.rotation.y += dt * speedRef.current;
  });
  return <group ref={ref}>{children}</group>;
}

const hasIO = typeof IntersectionObserver !== 'undefined';

export default function MiniCrop3D({
  id,
  accelerate = false,
  size = 88,
  className = '',
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Initialize state lazily so we can mount eagerly in environments
  // without IntersectionObserver (e.g. tests, very old browsers) without
  // running a setState inside an effect.
  const [mounted, setMounted] = useState(() => !hasIO);
  const [visible, setVisible] = useState(() => !hasIO);

  // Lazy-mount: don't allocate a WebGL context until the card scrolls
  // close enough to the viewport. After mount we still pause the loop
  // when fully off-screen so a long page doesn't get 50× idle canvases.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !hasIO) return;

    const mountObs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMounted(true);
          mountObs.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    mountObs.observe(el);

    const visObs = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    visObs.observe(el);

    return () => {
      mountObs.disconnect();
      visObs.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`${styles.holder} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {mounted ? (
        <Canvas
          dpr={[1, 1.25]}
          camera={{ position: [3.0, 1.4, 3.4], fov: 36 }}
          frameloop={visible ? 'always' : 'never'}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            outputColorSpace: THREE.SRGBColorSpace,
            alpha: true,
            powerPreference: 'low-power',
          }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.6} color="#ffffff" />
            <hemisphereLight args={['#fff5d6', '#0a2415', 0.4]} />
            <directionalLight position={[3, 4, 2.5]} intensity={1.4} color="#fff5dc" />
            <directionalLight position={[-3, 1, -1.5]} intensity={0.4} color="#cde9ff" />
            <Environment preset="apartment" environmentIntensity={0.55} />

            <group position={[0, -0.15, 0]}>
              <Spinner accelerate={accelerate}>
                <MiniModel id={id} />
              </Spinner>
            </group>
          </Suspense>
        </Canvas>
      ) : (
        <div className={styles.shimmer} />
      )}
    </div>
  );
}
