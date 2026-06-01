import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { CONFIG, hexToLinearRGB } from './config';

gsap.registerPlugin(ScrollTrigger);

// =====================================================
// EL NÚCLEO "SEAMLESS": un único requestAnimationFrame.
//
//   gsap.ticker  ──tick──►  lenis.raf(t)  ──emite 'scroll'──►  ScrollTrigger.update()
//                                                                      │
//                                                                      ▼
//                                                          (scrub) interpola `stage`
//                                                                      │
//                       advance(t)  ◄──── renderiza R3F leyendo `stage`
//
// Al actualizar Lenis, GSAP y el renderer EN EL MISMO frame y EN ORDEN,
// no hay relojes desincronizados → desaparecen los micro-tirones. Esa es
// la sensación de fluidez de OPPO.
// =====================================================

// Traduce un keyframe de sección al objeto de variables que GSAP tween-ea.
function sectionVars(section) {
  const rgb = hexToLinearRGB(section.mood.bg);
  return {
    camX: section.cam.pos[0], camY: section.cam.pos[1], camZ: section.cam.pos[2],
    tgtX: section.cam.target[0], tgtY: section.cam.target[1], tgtZ: section.cam.target[2],
    rotY: section.model.rotY,
    mscale: section.model.scale,
    key: section.mood.key, fill: section.mood.fill, rim: section.mood.rim,
    accent: section.mood.accent ?? 0,
    exposure: section.mood.exposure,
    bgR: rgb.r, bgG: rgb.g, bgB: rgb.b,
  };
}

// Estado 3D inicial (sección 0). El componente lo usa para que R3F tenga
// valores válidos desde el primer frame, antes de que el scroll los mueva.
export function createInitialStage(sections) {
  return {
    ...sectionVars(sections[0]),
    orbit: false, // ¿OrbitControls al mando? (sección interactiva)
    orbitBlend: 0, // 0 = cámara por scroll · 1 = usuario orbitando (lerp)
    activeIndex: 0, // sección activa (para mostrar sus hotspots)
  };
}

export function useUnifiedScroll({ rootRef, advanceRef, stageRef, flags, sections }) {
  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return undefined;

    const prevLagSmoothing = gsap.ticker._lagSmoothing; // restaurar al desmontar

    // -------------------------------------------------------------
    // A11y · prefers-reduced-motion → SIN Lenis ni scrub agresivo.
    // El loop unificado se reduce a conducir el render de R3F; cada
    // sección hace un "salto" suave a su encuadre al entrar (fallback
    // estático y elegante).
    // -------------------------------------------------------------
    if (flags.reducedMotion) {
      const tickReduced = (time) => advanceRef.current?.(time * 1000);
      gsap.ticker.add(tickReduced);

      const ctx = gsap.context(() => {
        sections.forEach((section, i) => {
          const el = root.querySelector(`#exp-${section.id}`);
          if (!el) return;
          ScrollTrigger.create({
            trigger: el, start: 'top center', end: 'bottom center',
            onToggle: (self) => {
              if (!self.isActive) return;
              stage.activeIndex = i;
              stage.orbit = !!section.orbit;
              // Tween corto al encuadre (no es scrub continuo).
              gsap.to(stage, { ...sectionVars(section), duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
            },
          });
          gsap.fromTo(el.querySelectorAll('[data-reveal]'),
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06,
              scrollTrigger: { trigger: el, start: 'top 78%' } });
        });
      }, root);

      return () => {
        gsap.ticker.remove(tickReduced);
        ctx.revert();
      };
    }

    // -------------------------------------------------------------
    // Loop unificado COMPLETO
    // -------------------------------------------------------------
    const lenis = new Lenis({
      lerp: CONFIG.LENIS.lerp,
      wheelMultiplier: CONFIG.LENIS.wheelMultiplier,
      touchMultiplier: CONFIG.LENIS.touchMultiplier,
      smoothWheel: CONFIG.LENIS.smoothWheel,
    });

    // (1) Cada scroll de Lenis sincroniza ScrollTrigger en el acto.
    lenis.on('scroll', ScrollTrigger.update);

    // (2) EL ÚNICO RAF. Orden importa: primero Lenis (mueve scroll + dispara
    //     ScrollTrigger.update → scrub actualiza `stage`), DESPUÉS render.
    const tick = (time) => {
      lenis.raf(time * 1000);
      advanceRef.current?.(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0); // el scrub debe seguir al scroll real, sin compensación

    const ctx = gsap.context(() => {
      // (3) TIMELINE MAESTRA · scrubbeada a lo largo de todo el documento.
      //     Interpola `stage` entre los keyframes de cada sección.
      const tl = gsap.timeline({
        defaults: { ease: CONFIG.EASE },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: CONFIG.SCRUB,
        },
      });

      // Estado inicial = sección 0.
      Object.assign(stage, sectionVars(sections[0]));

      // ↓↓↓ CADA .to() ES UNA TRANSICIÓN DE SCROLL → 3D (editable) ↓↓↓
      // La transición (i-1 → i) ocupa 1 "unidad" del timeline = ~1 pantallazo.
      for (let i = 1; i < sections.length; i++) {
        tl.to(stage, {
          ...sectionVars(sections[i]),
          ease: i === 1 ? CONFIG.EASE_HERO : CONFIG.EASE, // "settle" del hero
        }, i - 1);
      }

      // (4) Triggers por sección: índice activo (hotspots), handoff a
      //     OrbitControls y reveal del texto sincronizado.
      sections.forEach((section, i) => {
        const el = root.querySelector(`#exp-${section.id}`);
        if (!el) return;
        ScrollTrigger.create({
          trigger: el, start: 'top center', end: 'bottom center',
          onToggle: (self) => {
            if (!self.isActive) return;
            stage.activeIndex = i;
            stage.orbit = !!section.orbit; // ← activa/desactiva OrbitControls
          },
        });
        gsap.fromTo(el.querySelectorAll('[data-reveal]'),
          { autoAlpha: 0, y: 28 },
          { autoAlpha: 1, y: 0, duration: 0.85, ease: 'expo.out', stagger: 0.08,
            scrollTrigger: { trigger: el, start: 'top 72%', toggleActions: 'play none none reverse' } });
      });
    }, root);

    // Layout ya montado → recalcula posiciones de los triggers.
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(prevLagSmoothing ?? 500, 33);
      lenis.destroy();
      ctx.revert();
    };
  }, [rootRef, advanceRef, stageRef, flags.reducedMotion, sections]);
}
