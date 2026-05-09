import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';
import Model from './Model';
import Loader from './Loader';

// =====================================================
// Escena 3D minimalista y confiable.
// - Una key light direccional + ambient + Environment preset.
// - ContactShadows para anclar el modelo al "suelo".
// - OrbitControls con rangos limitados y auto-rotate sutil.
// - Antialiasing nativo MSAA del WebGL: sin EffectComposer
//   para evitar el conflicto de depth/stencil attachments
//   que provoca "Context Lost" con Bloom + shadows.
// =====================================================

export default function Scene({ product }) {
  return (
    <div className="relative h-full w-full">
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

          <group key={product.id} position={[0, 0, 0]}>
            <Model id={product.id} />
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

      <Loader />
    </div>
  );
}
