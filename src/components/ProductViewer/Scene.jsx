import { Suspense, useLayoutEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import Model from './Model';
import Loader from './Loader';

// Color management explícito (base del pipeline fotográfico). En r169 ya
// viene activo por defecto, pero lo fijamos para no depender del default:
// garantiza que las texturas sRGB se decodifiquen a lineal antes del
// shading y que el output se recodifique a sRGB tras el tone mapping.
THREE.ColorManagement.enabled = true;

// RectAreaLight necesita sus LUTs (LTC de Heitz/Hill) inicializadas una
// sola vez. Son dos DataTextures globales compartidas por TODAS las luces
// de área — coste fijo de 2 samplers por material físico, no por luz.
RectAreaLightUniformsLib.init();

// Softbox de estudio: una RectAreaLight orientada al sujeto. Es lo que
// produce el highlight especular ANCHO y SUAVE (forma de panel) sobre las
// superficies cerosas/húmedas — la firma inconfundible de la fotografía de
// producto. Las point/spot dan destellos puntuales; sólo una luz de área
// da el reflejo rectangular difuso. No proyecta sombra (de eso se encarga
// la directional key), así que no compite por el shadow map.
function SoftBox({ position, intensity, width, height, color }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    ref.current?.lookAt(0, 0, 0);
  }, []);
  return (
    <rectAreaLight
      ref={ref}
      position={position}
      intensity={intensity}
      width={width}
      height={height}
      color={color}
    />
  );
}

// =====================================================
// Escena 3D estilo "fotografía de producto":
//
//  - Esquema de estudio: dos SOFTBOXES (RectAreaLight key cálida +
//    fill fría) que dibujan el highlight de panel ancho y suave sobre
//    las superficies cerosas, + una directional que aporta la SOMBRA
//    proyectada (las RectAreaLight no la generan), + un rim/back para
//    separar del fondo y activar la translucidez, + hemisphere de
//    ambiente. Combinado con el IBL del Environment.
//  - Environment 'studio' para reflejos PBR creíbles en clearcoat,
//    sheen y transmission. envMapIntensity controlado por material.
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
          // Exposure 1.05 — bajada leve al introducir las RectAreaLights de
          // estudio (key + fill), que aportan luz especular adicional. Es el
          // knob principal a calibrar a ojo en dispositivo si el conjunto
          // queda algo claro/oscuro tras este pase.
          toneMappingExposure: 1.05,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          {/* Ambient muy bajo — dejamos que las luces directas, las
              softboxes de área y el environment hagan el trabajo. */}
          <ambientLight intensity={0.16} color="#ffffff" />

          {/* Hemisphere sutil: cielo cálido / piso frío */}
          <hemisphereLight args={['#fff5e0', '#1a2a3a', 0.30]} />

          {/* KEY direccional: ahora su rol PRINCIPAL es proyectar la sombra
              (las RectAreaLights no proyectan sombra). Bajada 2.0->1.5 porque
              el highlight especular cálido lo aporta ahora la softbox key.
              shadow-radius 4: penumbra suave sin pasarse del presupuesto de
              samples del shadow map en drivers iOS/Mac. */}
          <directionalLight
            position={[4.5, 6, 3.2]}
            intensity={1.5}
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

          {/* SOFTBOX KEY (luz de área cálida, arriba-derecha-frente). Es la
              que dibuja el highlight rectangular suave sobre cáscara de
              sandía, granos de maíz y testa del frijol — el reflejo de panel
              de un set fotográfico. Reemplaza el destello puntual anterior. */}
          <SoftBox
            position={[3.6, 4.2, 3.4]}
            intensity={4.0}
            width={3.5}
            height={4.5}
            color="#fff1da"
          />

          {/* SOFTBOX FILL (luz de área fría, izquierda). Rellena las sombras
              con un panel ancho y frío en lugar de una direccional dura;
              suaviza el contraste sin matar el modelado. Sustituye al
              directional fill frío anterior. */}
          <SoftBox
            position={[-4.2, 1.8, 1.2]}
            intensity={1.9}
            width={5.0}
            height={4.0}
            color="#dbe8ff"
          />

          {/* RIM/back light: separa al sujeto del fondo y ACTIVA la
              translucidez (transmission) de pulpa de sandía y hojas de
              frijol al iluminarlas por detrás. Vital para el look macro. */}
          <spotLight
            position={[-2, 4.5, -4.5]}
            angle={0.6}
            penumbra={0.85}
            intensity={1.6}
            color="#ffffff"
            distance={14}
            decay={1.2}
          />

          {/* Eye light: pequeña frontal para chispazos en gotas de rocío y
              micro-highlights. Bajada 0.5->0.3: la softbox key ya cubre el
              grueso del especular frontal. */}
          <pointLight
            position={[1.5, 1.2, 4.5]}
            intensity={0.3}
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
