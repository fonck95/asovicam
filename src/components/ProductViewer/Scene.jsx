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
        // dpr capeado a 1.5 (antes 2) — iOS Safari y Macs con pantalla
        // Retina llegaban a un buffer 4× el viewport con MeshPhysicalMaterial
        // (clearcoat+sheen+anisotropy = ~7 samplers), excediendo el límite
        // de samplers concurrentes del driver Metal-backed y produciendo
        // los bugs visuales reportados.
        dpr={[1, 1.5]}
        camera={{ position: [3.4, 1.7, 3.8], fov: 32 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          // Exposure 1.08 — subida ligera tras quitar la SSS por transmission
          // (que sobre-iluminaba el rim) para mantener la sensación de cob
          // dorado pero sin clipping de highlights.
          toneMappingExposure: 1.08,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          {/* Ambient muy bajo — dejamos que las luces directas y el
              environment hagan el trabajo. */}
          <ambientLight intensity={0.18} color="#ffffff" />

          {/* Hemisphere sutil: cielo cálido / piso frío */}
          <hemisphereLight args={['#fff5e0', '#1a2a3a', 0.32]} />

          {/* KEY light: principal, desde arriba-derecha, tonalidad cálida.
              shadow-radius reducido a 4 (era 6) — radios PCF altos requieren
              demasiados samples del shadow map y en algunos drivers iOS/Mac
              causan undefined behavior (negro intermitente). 4 mantiene
              penumbra suave sin pasarse del presupuesto de samples. */}
          <directionalLight
            position={[4.5, 6, 3.2]}
            intensity={2.0}
            color="#fff3d6"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0002}
            shadow-normalBias={0.03}
            shadow-radius={4}
          >
            <orthographicCamera
              attach="shadow-camera"
              args={[-3.5, 3.5, 3.5, -3.5, 0.1, 14]}
            />
          </directionalLight>

          {/* FILL light: relleno desde el otro lado, tonalidad fría */}
          <directionalLight
            position={[-4, 2, -1.5]}
            intensity={0.6}
            color="#cfe2ff"
          />

          {/* RIM/back light: separa al sujeto del fondo, vital para
              el look "marketing". Crea un halo en los bordes. */}
          <spotLight
            position={[-2, 4.5, -4.5]}
            angle={0.6}
            penumbra={0.85}
            intensity={1.6}
            color="#ffffff"
            distance={14}
            decay={1.2}
          />

          {/* Eye light: pequeña frontal para gotas/highlights especulares */}
          <pointLight
            position={[1.5, 1.2, 4.5]}
            intensity={0.5}
            color="#fff8e7"
            distance={9}
            decay={1.5}
          />

          {/* Acento de color cálido desde abajo-derecha (fill rebote) —
              da "calidez" al objeto sin sobre-exponer */}
          <pointLight
            position={[2.5, -1.5, 2]}
            intensity={0.35}
            color="#ffd9a0"
            distance={6}
            decay={1.8}
          />

          {/* Environment 'studio': cubemap procedural HDR estilo softbox
              alrededor del sujeto. Crítico para clearcoat, sheen,
              transmission y anisotropy — el GGX anisotrópico de Heitz
              integra el environment con la NDF colapsada, así que sin
              un IBL prefiltrado los reflejos elongados se ven planos.
              drei.Environment usa PMREMGenerator (split-sum de Karis,
              UE4) internamente. environmentIntensity=1.10 sube la
              contribución IBL para compensar el envMapIntensity bajado
              en cob core y husks. */}
          <Environment preset="studio" environmentIntensity={1.10} />

          <group key={product.id} position={[0, 0, 0]}>
            <Model id={product.id} />
          </group>

          {/* Sombra de contacto bajo el modelo */}
          <ContactShadows
            position={[0, -1.05, 0]}
            opacity={0.62}
            scale={7}
            blur={2.4}
            far={2.4}
            resolution={2048}
            color="#1a0e04"
          />

          {/* Disco sutil que da una "base" óptica + leve highlight
              concéntrico para vender el look studio. Separados por
              0.012 (era 0.002, debajo de la precisión del z-buffer)
              para eliminar z-fighting que parpadeaba en cada frame. */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -1.048, 0]}
            receiveShadow
          >
            <circleGeometry args={[3.2, 96]} />
            <meshStandardMaterial
              color="#f7f3ea"
              roughness={0.95}
              metalness={0}
              transparent
              opacity={0.22}
            />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -1.036, 0]}
            renderOrder={1}
          >
            <ringGeometry args={[1.4, 1.65, 96]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.06}
              depthWrite={false}
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
