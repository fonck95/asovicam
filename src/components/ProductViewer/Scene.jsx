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
// Escena 3D estilo "fotografía de producto":
//
//  - Iluminación de 3 puntos: key (cálida) + fill (fría) + rim
//    (back light), más hemisphere para color global ambiental.
//  - Environment 'studio' para reflejos PBR creíbles en clearcoat
//    y sheen. envMapIntensity controlado por material.
//  - ContactShadows con resolución alta para anclar el modelo.
//  - OrbitControls con rangos generosos pero limitados para que
//    el usuario no acabe debajo del piso.
//  - Sin EffectComposer: el bloom + shadows produce Context Lost
//    en algunas GPUs. La calidad viene de los materiales y la luz.
// =====================================================

export default function Scene({ product }) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [3.4, 1.7, 3.8], fov: 32 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          {/* Ambient muy bajo — dejamos que las luces directas y el
              environment hagan el trabajo. */}
          <ambientLight intensity={0.22} color="#ffffff" />

          {/* Hemisphere sutil: cielo cálido / piso frío */}
          <hemisphereLight args={['#fff5e0', '#1a2a3a', 0.3]} />

          {/* KEY light: principal, desde arriba-derecha, tonalidad cálida */}
          <directionalLight
            position={[4.5, 6, 3.2]}
            intensity={1.85}
            color="#fff3d6"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0002}
            shadow-normalBias={0.025}
            shadow-radius={6}
          >
            <orthographicCamera
              attach="shadow-camera"
              args={[-3.5, 3.5, 3.5, -3.5, 0.1, 14]}
            />
          </directionalLight>

          {/* FILL light: relleno desde el otro lado, tonalidad fría */}
          <directionalLight
            position={[-4, 2, -1.5]}
            intensity={0.55}
            color="#cfe2ff"
          />

          {/* RIM/back light: separa al sujeto del fondo, vital para
              el look "marketing". Crea un halo en los bordes. */}
          <spotLight
            position={[-2, 4.5, -4.5]}
            angle={0.6}
            penumbra={0.85}
            intensity={1.4}
            color="#ffffff"
            distance={14}
            decay={1.2}
          />

          {/* Pequeña luz frontal de relleno (eye light) para ojos
              especulares en frutas brillantes */}
          <pointLight
            position={[1.5, 1.2, 4.5]}
            intensity={0.4}
            color="#fff8e7"
            distance={9}
            decay={1.5}
          />

          <Environment preset="studio" environmentIntensity={0.9} />

          <group key={product.id} position={[0, 0, 0]}>
            <Model id={product.id} />
          </group>

          {/* Sombra de contacto bajo el modelo */}
          <ContactShadows
            position={[0, -1.05, 0]}
            opacity={0.55}
            scale={7}
            blur={2.6}
            far={2.4}
            resolution={2048}
            color="#1a0e04"
          />

          {/* Disco sutil que da una "base" óptica al modelo */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -1.045, 0]}
            receiveShadow
          >
            <circleGeometry args={[3.2, 64]} />
            <meshStandardMaterial
              color="#f5f2ea"
              roughness={0.95}
              metalness={0}
              transparent
              opacity={0.18}
            />
          </mesh>
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={2.6}
          maxDistance={6.5}
          minPolarAngle={Math.PI / 5.5}
          maxPolarAngle={Math.PI / 2 + 0.05}
          enableDamping
          dampingFactor={0.08}
          autoRotate
          autoRotateSpeed={0.6}
        />
      </Canvas>

      <Loader />
    </div>
  );
}
