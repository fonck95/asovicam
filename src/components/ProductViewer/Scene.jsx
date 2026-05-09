import { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  AccumulativeShadows,
  ContactShadows,
  Environment,
  Lightformer,
  PresentationControls,
  RandomizedLight,
} from '@react-three/drei';
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
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
// Estudio fotográfico procedural:
// - HDRI ambiental con lightformers personalizados (key + fill +
//   rim) para reflejos suaves y un highlight cinematográfico.
// - AccumulativeShadows + RandomizedLight para sombras suaves
//   tipo softbox sin necesidad de baked maps.
// - Postprocessing: N8AO (oclusión ambiental moderna), Bloom sutil,
//   HueSaturation y Vignette para acabado profesional.
// - Color management ACES Filmic + sRGB output.
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
        camera={{ position: [0, 0.6, 4.2], fov: 32 }}
        frameloop={hovered ? 'demand' : 'always'}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          {/* Hemispheric ambient + soft key/fill */}
          <hemisphereLight args={['#fef9c3', '#1a2e05', 0.45]} />
          <ambientLight intensity={0.18} color="#ffffff" />

          {/* Key light from upper-front-right (warm sun) */}
          <directionalLight
            position={[3.5, 4.5, 3]}
            intensity={1.6}
            color="#fff7e6"
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

          {/* Fill light from camera-left (cool bounce) */}
          <directionalLight
            position={[-3.5, 2, 2]}
            intensity={0.55}
            color="#dbeafe"
          />

          {/* Rim light from behind for separation */}
          <directionalLight
            position={[0, 1.5, -4]}
            intensity={0.7}
            color="#fef3c7"
          />

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
            <group position={[0, 0, 0]}>
              <Model
                product={product}
                autoRotate
                hovered={hovered}
                useFallback={useFallback}
              />
            </group>
          </PresentationControls>

          {/* Studio HDRI built in-engine using lightformers — no external
              fetch required, deterministic across environments. */}
          <Environment
            background={false}
            resolution={512}
            environmentIntensity={0.85}
          >
            {/* Key softbox (warm) */}
            <Lightformer
              form="rect"
              intensity={3.5}
              color="#fff5d6"
              scale={[5, 3, 1]}
              position={[3, 4, 3]}
              rotation={[-0.4, 0.6, 0]}
            />
            {/* Fill softbox (cool) */}
            <Lightformer
              form="rect"
              intensity={1.8}
              color="#dbeafe"
              scale={[4, 4, 1]}
              position={[-4, 2, 2]}
              rotation={[0, -0.6, 0]}
            />
            {/* Top dome */}
            <Lightformer
              form="ring"
              intensity={1.2}
              color="#ffffff"
              scale={[6, 6, 1]}
              position={[0, 6, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            />
            {/* Rim back light */}
            <Lightformer
              form="rect"
              intensity={2.2}
              color="#fde68a"
              scale={[3, 1.5, 1]}
              position={[0, 2, -4]}
              rotation={[0, Math.PI, 0]}
            />
            {/* Ground bounce */}
            <Lightformer
              form="rect"
              intensity={0.6}
              color="#fef3c7"
              scale={[6, 6, 1]}
              position={[0, -3, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          </Environment>

          {/* Soft accumulated shadows under the model — gives it weight */}
          <AccumulativeShadows
            position={[0, -1.05, 0]}
            frames={80}
            alphaTest={0.85}
            opacity={0.7}
            scale={6}
            color="#1a1206"
            temporal
          >
            <RandomizedLight
              amount={6}
              radius={4.5}
              ambient={0.5}
              intensity={1.6}
              position={[3, 4, 3]}
              bias={0.001}
            />
          </AccumulativeShadows>

          {/* Sharper near-contact shadow for grounding */}
          <ContactShadows
            position={[0, -1.04, 0]}
            opacity={0.45}
            scale={6}
            blur={1.6}
            far={2.5}
            resolution={1024}
            color="#1a1206"
          />

          <ScrollZoom />
        </Suspense>

        {/* Postprocessing — modern AO + cinematic finish */}
        <EffectComposer multisampling={4} enableNormalPass>
          <N8AO
            aoRadius={0.6}
            distanceFalloff={0.4}
            intensity={2.4}
            quality="medium"
            color="#0b0a08"
          />
          <Bloom
            intensity={0.35}
            luminanceThreshold={0.82}
            luminanceSmoothing={0.25}
            mipmapBlur
          />
          <HueSaturation hue={0} saturation={0.08} />
          <BrightnessContrast brightness={0.0} contrast={0.08} />
          <Vignette
            offset={0.32}
            darkness={0.55}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>

      <Loader />
    </div>
  );
}
