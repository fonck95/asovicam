import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from './config';
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

export default function Experience({ sections, tour = false }) {
  const flags = useFlags();

  // `sections` ya viene NORMALIZADO desde products.js: cada sección lleva su
  // cultivo (productId/modelId), su altura de sombra (groundY) y la escala con
  // baseScale ya plegado. En el recorrido completo son los tres cultivos
  // encadenados; en un deep-link, las de un solo cultivo. Stage y Overlay
  // leen todo lo demás de aquí.

  const rootRef = useRef(null);      // contenedor scrolleable (define la altura/timeline)
  const advanceRef = useRef(null);   // R3F advance(): renderiza UN frame bajo demanda
  const lenisRef = useRef(null);     // instancia Lenis (para el salto del switcher)
  const stageRef = useRef(null);     // objeto compartido scroll → 3D
  if (!stageRef.current) stageRef.current = createInitialStage(sections);

  // Engancha Lenis + gsap.ticker + advance en UN solo RAF y construye el timeline.
  useUnifiedScroll({ rootRef, advanceRef, lenisRef, stageRef, flags, sections });

  // Salto suave a un cultivo DENTRO del recorrido (sin recargar la página):
  // el switcher en modo recorrido lo usa para llevar el scroll al hero de ese
  // cultivo. Usa Lenis si está activo; si no (reduced-motion), scroll nativo.
  const handleJump = useCallback((sectionId) => {
    if (!sectionId) return;
    const target = `#exp-${sectionId}`;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.1 });
    else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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
            <Stage stageRef={stageRef} flags={flags} sections={sections} />
          </Suspense>
        </Canvas>
      </div>

      {/* Loader premium (fuera del Canvas: es DOM). */}
      <ProgressLoader />

      {/* Secciones de texto que definen la longitud del scroll. */}
      <div ref={rootRef} className={styles.scroll}>
        <Overlay sections={sections} tour={tour} onJump={handleJump} />
      </div>
    </div>
  );
}
