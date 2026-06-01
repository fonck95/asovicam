import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from './config';
import { getProduct } from './products';
import { createInitialStage, useUnifiedScroll } from './useUnifiedScroll';
import Stage from './Stage';
import Overlay from './Overlay';
import ProgressLoader from './ProgressLoader';
import styles from './Experience.module.css';

// Color management explícito: texturas sRGB → lineal antes del shading,
// output recodificado tras el tone mapping.
THREE.ColorManagement.enabled = true;

// ---------- Flags responsive + accesibilidad ----------
function computeFlags() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { reducedMotion: false, mobile: false, pointer: true, post: true };
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`).matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return {
    reducedMotion,
    mobile,
    // Parallax de puntero: solo en desktop con puntero fino y sin reduced-motion.
    pointer: !mobile && !coarse && !reducedMotion,
    // Post: nunca con reduced-motion (Stage además apaga bloom en móvil).
    post: !reducedMotion,
  };
}

function useFlags() {
  const [flags, setFlags] = useState(computeFlags);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const queries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia(`(max-width: ${CONFIG.MOBILE_BREAKPOINT}px)`),
      window.matchMedia('(pointer: coarse)'),
    ];
    const update = () => setFlags(computeFlags());
    queries.forEach((q) => q.addEventListener('change', update));
    return () => queries.forEach((q) => q.removeEventListener('change', update));
  }, []);
  return flags;
}

export default function Experience({ productId }) {
  const flags = useFlags();

  // Producto activo (maíz / frijol / sandía). De él salen el guion, el modelo
  // y el "tuning" de encuadre. Experience se remonta (key=productId en la
  // página) al cambiar de producto, así que basta resolverlo una vez.
  const product = getProduct(productId);
  const { sections, modelId, baseScale, groundY, yOffset } = product;

  const rootRef = useRef(null);      // contenedor scrolleable (define la altura/timeline)
  const advanceRef = useRef(null);   // R3F advance(): renderiza UN frame bajo demanda
  const stageRef = useRef(null);     // objeto compartido scroll → 3D
  if (!stageRef.current) stageRef.current = createInitialStage(sections);

  // Engancha Lenis + gsap.ticker + advance en UN solo RAF y construye el timeline.
  useUnifiedScroll({ rootRef, advanceRef, stageRef, flags, sections });

  return (
    <div className={styles.root}>
      {/* CANVAS FIJO: el producto persiste en pantalla mientras el texto
          scrollea por encima (el "world changes around the product" de OPPO). */}
      <div className={styles.canvasWrap}>
        <Canvas
          // frameloop="never" → R3F NO corre su propio RAF; lo conduce
          // nuestro ticker unificado vía advance(). Aquí está la unificación.
          frameloop="never"
          dpr={flags.mobile ? CONFIG.DPR_MOBILE : CONFIG.DPR_DESKTOP}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: sections[0].mood.exposure,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          camera={{ position: sections[0].cam.pos, fov: 35, near: 0.1, far: 100 }}
          onCreated={(state) => {
            // Exporta advance() para el loop unificado del hook.
            advanceRef.current = state.advance;
            const [tx, ty, tz] = sections[0].cam.target;
            state.camera.lookAt(tx, ty, tz);
          }}
        >
          <Suspense fallback={null}>
            <Stage
              stageRef={stageRef}
              flags={flags}
              sections={sections}
              modelId={modelId}
              baseScale={baseScale}
              groundY={groundY}
              yOffset={yOffset}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Loader premium (fuera del Canvas: es DOM). */}
      <ProgressLoader />

      {/* Secciones de texto que definen la longitud del scroll. */}
      <div ref={rootRef} className={styles.scroll}>
        <Overlay sections={sections} activeId={product.id} />
      </div>
    </div>
  );
}
