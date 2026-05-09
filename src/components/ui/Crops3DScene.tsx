import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import CornModel from '../ProductViewer/models/CornModel';
import BeanModel from '../ProductViewer/models/BeanModel';
import WatermelonModel from '../ProductViewer/models/WatermelonModel';
import styles from './Crops3DScene.module.css';

type CropKey = 'maiz' | 'frijol' | 'sandia';

interface CropDef {
  key: CropKey;
  label: string;
  scientific: string;
  tagline: string;
  accent: string;
  accentSoft: string;
}

const CROPS: CropDef[] = [
  {
    key: 'maiz',
    label: 'Maíz',
    scientific: 'Zea mays',
    tagline: 'El pilar vertical de la milpa',
    accent: '#f59e0b',
    accentSoft: 'rgba(245, 158, 11, 0.15)',
  },
  {
    key: 'frijol',
    label: 'Frijol caupí',
    scientific: 'Vigna unguiculata',
    tagline: 'Trepa el maíz y fija nitrógeno',
    accent: '#22c55e',
    accentSoft: 'rgba(34, 197, 94, 0.15)',
  },
  {
    key: 'sandia',
    label: 'Sandía',
    scientific: 'Citrullus lanatus',
    tagline: 'Tapiza el suelo y conserva humedad',
    accent: '#ef4444',
    accentSoft: 'rgba(239, 68, 68, 0.15)',
  },
];

function CropModel({ id }: { id: CropKey }) {
  if (id === 'frijol') return <BeanModel />;
  if (id === 'sandia') return <WatermelonModel />;
  return <CornModel />;
}

interface Crops3DSceneProps {
  className?: string;
}

export default function Crops3DScene({ className = '' }: Crops3DSceneProps) {
  const [active, setActive] = useState<CropKey>('maiz');

  const userInteractedRef = useRef(false);
  useEffect(() => {
    if (userInteractedRef.current) return;
    const id = window.setInterval(() => {
      if (userInteractedRef.current) return;
      setActive((prev) => {
        const i = CROPS.findIndex((c) => c.key === prev);
        return CROPS[(i + 1) % CROPS.length].key;
      });
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  const activeCrop = CROPS.find((c) => c.key === active) ?? CROPS[0];

  const handleSelect = (key: CropKey) => {
    userInteractedRef.current = true;
    setActive(key);
  };

  return (
    <div
      className={`${styles.wrapper} ${className}`}
      style={{ ['--accent' as string]: activeCrop.accent }}
    >
      <div className={styles.gradient} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.stage}>
        <div className={styles.canvasHolder}>
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [3.2, 1.6, 3.6], fov: 35 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1,
              outputColorSpace: THREE.SRGBColorSpace,
              powerPreference: 'high-performance',
            }}
          >
            <Suspense fallback={null}>
              <ambientLight intensity={0.45} color="#ffffff" />
              <hemisphereLight args={['#fff7d6', '#1f2937', 0.35]} />

              <directionalLight
                position={[4, 5.5, 3]}
                intensity={1.6}
                color="#fff5e0"
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0002}
                shadow-normalBias={0.02}
              >
                <orthographicCamera
                  attach="shadow-camera"
                  args={[-3, 3, 3, -3, 0.1, 12]}
                />
              </directionalLight>

              <directionalLight
                position={[-4, 2, -2]}
                intensity={0.35}
                color="#dbeafe"
              />

              <Environment preset="apartment" environmentIntensity={0.55} />

              <group key={active} position={[0, 0, 0]}>
                <CropModel id={active} />
              </group>

              <ContactShadows
                position={[0, -1.05, 0]}
                opacity={0.5}
                scale={6}
                blur={2.4}
                far={2.2}
                resolution={1024}
                color="#1a1206"
              />
            </Suspense>

            <OrbitControls
              enablePan={false}
              minDistance={2.6}
              maxDistance={6.2}
              minPolarAngle={Math.PI / 5}
              maxPolarAngle={Math.PI / 2 + 0.05}
              enableDamping
              dampingFactor={0.08}
              autoRotate
              autoRotateSpeed={0.7}
            />
          </Canvas>
        </div>

        <div className={styles.info}>
          <span className={styles.infoEyebrow}>{activeCrop.scientific}</span>
          <h3 className={styles.infoTitle}>{activeCrop.label}</h3>
          <p className={styles.infoTagline}>{activeCrop.tagline}</p>
        </div>
      </div>

      <div className={styles.controls} role="tablist" aria-label="Selecciona un cultivo">
        {CROPS.map((crop) => (
          <button
            key={crop.key}
            type="button"
            role="tab"
            aria-selected={crop.key === active}
            className={`${styles.chip} ${crop.key === active ? styles.chipActive : ''}`}
            style={{ ['--accent' as string]: crop.accent }}
            onClick={() => handleSelect(crop.key)}
          >
            <span className={styles.dot} />
            {crop.label}
          </button>
        ))}
      </div>

      <span className={styles.credits}>
        Modelos 3D procedurales — ASOVICAM
      </span>

      <span className={styles.hint} aria-hidden="true">
        Arrastra para rotar · Scroll para acercar
      </span>
    </div>
  );
}
