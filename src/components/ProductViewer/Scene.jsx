import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  PresentationControls,
  Stage,
} from '@react-three/drei';
import {
  Bloom,
  EffectComposer,
  SSAO,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import Model from './Model';
import Loader from './Loader';

// Zoom con scroll limitado: ajusta la distancia de la cámara
// dentro de [MIN, MAX] sin permitir alejarse al infinito.
const MIN_ZOOM = 2.6;
const MAX_ZOOM = 6.5;

function ScrollZoom() {
  const { camera, gl, invalidate } = useThree();

  useEffect(() => {
    const dom = gl.domElement;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.0025;
      const dir = camera.position.clone().normalize();
      const newDist = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, camera.position.length() + delta * 4),
      );
      camera.position.copy(dir.multiplyScalar(newDist));
      invalidate();
    };
    dom.addEventListener('wheel', onWheel, { passive: false });
    return () => dom.removeEventListener('wheel', onWheel);
  }, [camera, gl, invalidate]);

  return null;
}

// =====================================================
// Canvas 3D con luces, sombras, postprocessing y controles.
// - DPR limitado a [1, 2] para no quemar GPU móvil.
// - Color management ACES Filmic + sRGB output.
// - frameloop="demand" cuando la auto-rotación está pausada
//   (al pasar el mouse) para ahorrar batería.
// =====================================================

export default function Scene({ product, useFallback }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative h-full w-full"
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.6, 4.2], fov: 35 }}
        frameloop={hovered ? 'demand' : 'always'}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
      >
        {/* Iluminación principal mediante <Stage> con preset rembrandt.
            El intensity se mantiene moderado para no quemar el modelo. */}
        <Suspense fallback={null}>
          <PresentationControls
            global
            cursor
            snap
            speed={1.2}
            zoom={1}
            rotation={[0, 0, 0]}
            polar={[-Math.PI / 6, Math.PI / 4]}
            azimuth={[-Math.PI / 1.6, Math.PI / 1.6]}
          >
            <Stage
              preset="soft"
              intensity={0.7}
              environment={null}
              shadows={false}
              adjustCamera={false}
            >
              <Model
                product={product}
                autoRotate
                hovered={hovered}
                useFallback={useFallback}
              />
            </Stage>
          </PresentationControls>

          {/* HDRI gratuito de Poly Haven cargado desde URL pública.
              Da reflejos y ambient lighting realista sin asset local. */}
          <Environment
            files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr"
            background={false}
          />

          <ContactShadows
            position={[0, -1.05, 0]}
            opacity={0.4}
            scale={8}
            blur={2.5}
            far={3}
            resolution={1024}
          />

          <ScrollZoom />
        </Suspense>

        {/* Postprocessing — bloom sutil + SSAO suave */}
        <EffectComposer enableNormalPass multisampling={0}>
          <SSAO
            samples={16}
            radius={0.08}
            intensity={20}
            luminanceInfluence={0.4}
            worldDistanceThreshold={1}
            worldDistanceFalloff={0.2}
            worldProximityThreshold={0.3}
            worldProximityFalloff={0.1}
          />
          <Bloom
            intensity={0.3}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      <Loader />
    </div>
  );
}
