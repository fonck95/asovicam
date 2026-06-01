import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  OrbitControls,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { CONFIG } from './config';
import ProtagonistModel from './ProtagonistModel';

// LUTs de las RectAreaLight (softboxes). Coste fijo global, una sola vez.
RectAreaLightUniformsLib.init();
const { damp } = THREE.MathUtils;

// ----------------------------------------------------------------
// Hotspot: punto 3D anclado al modelo (drei <Html>) que el usuario
// puede tocar para revelar una explicación. Coexiste con el scroll.
// ----------------------------------------------------------------
function Hotspot({ position, label, text }) {
  const [open, setOpen] = useState(false);
  return (
    <Html position={position} center distanceFactor={9} zIndexRange={[20, 0]} occlude={false}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: open ? '8px 12px' : 0,
          maxWidth: open ? 220 : 22,
          borderRadius: 14,
          background: open ? 'rgba(8,14,12,0.82)' : 'transparent',
          border: open ? '1px solid rgba(255,255,255,0.12)' : 'none',
          backdropFilter: open ? 'blur(8px)' : 'none',
          color: CONFIG.THEME.text,
          transition: 'max-width .35s cubic-bezier(.16,1,.3,1), padding .35s, background .35s',
          cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden
          style={{
            flex: '0 0 auto', width: 12, height: 12, borderRadius: '50%',
            background: CONFIG.THEME.accent,
            boxShadow: `0 0 0 4px ${CONFIG.THEME.accent}33, 0 0 14px ${CONFIG.THEME.accent}aa`,
          }}
        />
        <span style={{ whiteSpace: open ? 'normal' : 'nowrap', textAlign: 'left' }}>
          <strong style={{ fontSize: 12, display: 'block' }}>{label}</strong>
          {open && (
            <span style={{ fontSize: 11, lineHeight: 1.4, color: CONFIG.THEME.textDim }}>{text}</span>
          )}
        </span>
      </button>
    </Html>
  );
}

// Softbox = RectAreaLight orientada al sujeto (highlight ancho y suave).
function SoftBox({ lightRef, position, intensity, width, height, color }) {
  const ref = useRef(null);
  useLayoutEffect(() => { ref.current?.lookAt(0, 0, 0); }, []);
  return (
    <rectAreaLight
      ref={(n) => { ref.current = n; if (lightRef) lightRef.current = n; }}
      position={position} intensity={intensity} width={width} height={height} color={color}
    />
  );
}

export default function Stage({ stageRef, flags, sections }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  // Refs de los objetos que el scroll modula cada frame.
  const modelGroupRef = useRef(null);
  const controlsRef = useRef(null);
  const keyRef = useRef(null);
  const fillRef = useRef(null);
  const rimRef = useRef(null);
  const accentRef = useRef(null);

  // Estado interno del loop (no provoca re-render).
  const idle = useRef(0);          // ángulo idle acumulado del modelo
  const prevOrbit = useRef(false); // detectar flanco de entrada a órbita
  const pointer = useRef({ x: 0, y: 0 });

  // Vectores temporales reutilizados (cero allocaciones por frame).
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(
    () => new THREE.Vector3(sections[0].cam.target[0], sections[0].cam.target[1], sections[0].cam.target[2]),
    [sections],
  );

  // Sección activa → qué hotspots mostrar. Solo se actualiza al cambiar de
  // sección (re-render puntual, no por frame).
  const [activeIndex, setActiveIndex] = useState(0);

  // Modelos presentes en el guion (uno por cultivo). En el RECORRIDO COMPLETO
  // son los tres (maíz/frijol/sandía); en un deep-link, uno solo. Montamos
  // TODOS una vez y mostramos solo el del cultivo activo vía `visible` — así
  // no reconstruimos geometría a mitad de scroll (lo que daría un tirón) y el
  // ContactShadows solo recibe la pieza visible.
  const distinctModels = useMemo(() => {
    const ids = [];
    for (const sec of sections) {
      if (sec.modelId && !ids.includes(sec.modelId)) ids.push(sec.modelId);
    }
    return ids.length ? ids : [CONFIG.MODEL_ID];
  }, [sections]);

  // Encuadre del cultivo activo: qué modelo mostrar y a qué altura apoyar la
  // sombra. Como el cambio ocurre en el límite entre cultivos (junto al swap
  // del modelo), un salto discreto de groundY es coherente con la escena.
  const activeSection = sections[activeIndex] ?? sections[0];
  const activeModelId = activeSection.modelId ?? distinctModels[0];
  const activeGroundY = activeSection.groundY ?? -1.05;

  // Fondo de la escena como Color lineal (lo tiñe el scroll cada frame).
  useEffect(() => {
    scene.background = new THREE.Color(sections[0].mood.bg);
  }, [scene, sections]);

  // Parallax de puntero (solo desktop sin reduced-motion).
  useEffect(() => {
    if (!flags.pointer) return undefined;
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [flags.pointer]);

  // ============================================================
  // RENDER LOOP — aquí se APLICA el `stage` (movido por el scroll)
  // a las propiedades 3D. Es la otra mitad del puente scroll↔3D.
  // ============================================================
  useFrame((_, delta) => {
    const s = stageRef.current;
    if (!s) return;
    const dt = Math.min(delta, 0.05); // primer frame puede traer un delta enorme

    // Blend cinemático↔órbita (para apagar idle/parallax al orbitar).
    s.orbitBlend = damp(s.orbitBlend, s.orbit ? 1 : 0, 6, dt);
    const cine = 1 - s.orbitBlend;

    // ---- CÁMARA ----
    const controls = controlsRef.current;
    if (s.orbit) {
      if (controls) {
        // Handoff en el flanco de entrada: la órbita arranca desde la vista
        // cinemática actual (sin salto). drei llama a controls.update()
        // (damping + autoRotate) en su propio useFrame(-1) mientras enabled.
        if (!prevOrbit.current) controls.target.copy(lookTarget);
        controls.enabled = true;
        lookTarget.copy(controls.target); // recordar para el regreso suave a cinemático
      }
    } else {
      if (controls) controls.enabled = false;
      // Parallax de puntero sumado al keyframe de scroll (no pelea: es offset).
      const px = pointer.current.x * CONFIG.POINTER_PARALLAX * cine;
      const py = pointer.current.y * CONFIG.POINTER_PARALLAX * cine;
      tmpPos.set(s.camX + px, s.camY + py, s.camZ);
      // SCROLL → posición de cámara (lerp = el "arrastre" sedoso extra).
      camera.position.lerp(tmpPos, CONFIG.CAMERA_LERP);
      // SCROLL → target de cámara.
      lookTarget.lerp(tmpPos.set(s.tgtX, s.tgtY, s.tgtZ), CONFIG.CAMERA_LERP);
      camera.lookAt(lookTarget);
    }
    prevOrbit.current = s.orbit;

    // ---- MODELO: rotación (scroll + idle + parallax) y escala ----
    const g = modelGroupRef.current;
    if (g) {
      if (!s.orbit) idle.current += dt * CONFIG.IDLE_ROTATION_SPEED;
      const tilt = pointer.current.x * CONFIG.POINTER_MODEL_TILT * cine;
      // SCROLL → rotación Y del modelo (+ giro idle + parallax).
      g.rotation.y = damp(g.rotation.y, s.rotY + idle.current + tilt, 10, dt);
      g.rotation.x = damp(g.rotation.x, -pointer.current.y * 0.05 * cine, 5, dt);
      // SCROLL → escala del modelo (zoom-in/out del producto). El `baseScale`
      // de cada cultivo ya viene PLEGADO en el keyframe (products.js), así que
      // aquí basta con la escala interpolada del scroll.
      const sc = s.mscale;
      g.scale.setScalar(damp(g.scale.x, sc, CONFIG.DAMP, dt));
      // yOffset del cultivo activo (hoy 0 en los tres; se respeta por si algún
      // cultivo necesita subir/bajar en el mundo).
      g.position.y = (sections[s.activeIndex] ?? sections[0]).yOffset ?? 0;
    }

    // ---- LUCES + EXPOSICIÓN + FONDO (SCROLL → iluminación / mood) ----
    if (keyRef.current) keyRef.current.intensity = s.key;
    if (fillRef.current) fillRef.current.intensity = s.fill;
    if (rimRef.current) rimRef.current.intensity = s.rim;
    if (accentRef.current) accentRef.current.intensity = s.accent;
    gl.toneMappingExposure = damp(gl.toneMappingExposure, s.exposure, 4, dt);
    if (scene.background) {
      scene.background.setRGB(s.bgR, s.bgG, s.bgB, THREE.LinearSRGBColorSpace);
    }

    // ---- Hotspots de la sección activa ----
    if (s.activeIndex !== activeIndex) setActiveIndex(s.activeIndex);
  });

  const wantsBloom = CONFIG.POST.bloom && !flags.mobile;
  const wantsVignette = CONFIG.POST.vignette;
  const post = flags.post && CONFIG.POST.enabled && (wantsBloom || wantsVignette);
  const shadowRes = flags.mobile ? 512 : 1024;

  return (
    <>
      {/* Ambiente muy bajo: dejamos trabajar a softboxes + environment. */}
      <ambientLight intensity={CONFIG.LIGHTS.ambient} />
      <hemisphereLight args={['#fff5e0', '#0a1014', 0.28]} />

      {/* SOFTBOX KEY (cálida, arriba-derecha-frente): highlight ancho.
          La intensidad real la fija el scroll cada frame (stage.key). */}
      <SoftBox lightRef={keyRef} position={[3.6, 4.0, 3.4]} intensity={sections[0].mood.key}
        width={3.5} height={4.5} color={CONFIG.LIGHTS.keyColor} />
      {/* SOFTBOX FILL (fría, izquierda): rellena sombras sin matar el modelado. */}
      <SoftBox lightRef={fillRef} position={[-4.2, 1.8, 1.4]} intensity={1.4}
        width={5} height={4} color={CONFIG.LIGHTS.fillColor} />

      {/* RIM/back: separa del fondo y activa translucidez (hojas, pulpa). */}
      <spotLight ref={rimRef} position={[-2, 4.5, -4.5]} angle={0.6} penumbra={0.85}
        intensity={1.6} color={CONFIG.LIGHTS.rimColor} distance={16} decay={1.2} />

      {/* ACENTO cálido frontal-bajo: el scroll lo sube para "revelar detalle". */}
      <pointLight ref={accentRef} position={[1.6, 0.4, 3.2]} intensity={0}
        color={CONFIG.THEME.accentWarm} distance={9} decay={1.6} />

      {/* Environment de estudio OSCURO hecho con Lightformers (sin HDR externo).
          frames={1} lo hornea una vez → coste casi nulo. Da reflejos PBR
          creíbles en clearcoat/sheen sin depender de una descarga. */}
      <Environment resolution={flags.mobile ? 128 : 256} frames={1} background={false}>
        <Lightformer form="rect" intensity={1.6} color="#fff3d6" position={[3, 3, 2]} scale={[6, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.7} color="#bcd2ff" position={[-4, 1, 1]} scale={[6, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.5} color="#ffffff" position={[0, 3, -4]} scale={4} />
      </Environment>

      {/* MODELO PROTAGONISTA — el <group> es lo que el scroll rota/escala.
          En el recorrido completo viven aquí los tres cultivos; solo el activo
          es `visible`, y el swap ocurre al entrar el hero del siguiente. */}
      <group ref={modelGroupRef} position={[0, activeSection.yOffset ?? 0, 0]}>
        {distinctModels.map((mid) => (
          <group key={mid} visible={mid === activeModelId}>
            <ProtagonistModel modelId={mid} />
          </group>
        ))}

        {/* Hotspots de la sección activa (anclados al modelo, rotan con él). */}
        {activeSection?.hotspots?.map((h) => (
          <Hotspot key={h.id} position={h.position} label={h.label} text={h.text} />
        ))}
      </group>

      {/* Sombra de contacto: ancla el modelo sin shadow-maps (evita el
          Context Lost documentado al mezclar shadow-maps + bloom). La altura
          `activeGroundY` depende del cultivo activo (cada modelo "apoya" a
          distinta cota). `key` re-hornea la sombra al cambiar de cultivo —
          imprescindible en móvil, donde se bakea una sola vez (frames=1). */}
      <ContactShadows key={activeModelId} position={[0, activeGroundY, 0]} opacity={0.55} scale={7} blur={2.6}
        far={2.6} resolution={shadowRes} color="#000000" frames={flags.mobile ? 1 : undefined} />

      {/* OrbitControls: solo se ACTIVAN (enabled) en la sección interactiva;
          el resto del tiempo manda el scroll. autoRotate da "vida". */}
      <OrbitControls
        ref={controlsRef}
        // El prop sigue a la sección activa para que un re-render no resetee
        // el estado; además lo ajustamos imperativamente por frame en useFrame.
        enabled={!!activeSection?.orbit}
        enablePan={false}
        enableDamping
        dampingFactor={CONFIG.ORBIT.dampingFactor}
        minDistance={CONFIG.ORBIT.minDistance}
        maxDistance={CONFIG.ORBIT.maxDistance}
        minPolarAngle={CONFIG.ORBIT.minPolar}
        maxPolarAngle={CONFIG.ORBIT.maxPolar}
        autoRotate
        autoRotateSpeed={CONFIG.ORBIT.autoRotateSpeed}
        makeDefault
      />

      {/* Postprocesado opcional. Vignette siempre seguro; Bloom bajo CONFIG
          y nunca en móvil (presupuesto de fill-rate). */}
      {post && (
        <EffectComposer disableNormalPass multisampling={flags.mobile ? 0 : 4}>
          {[
            wantsBloom && (
              <Bloom
                key="bloom"
                mipmapBlur
                intensity={CONFIG.POST.bloomIntensity}
                luminanceThreshold={CONFIG.POST.bloomThreshold}
                radius={CONFIG.POST.bloomRadius}
              />
            ),
            wantsVignette && (
              <Vignette key="vignette" eskil={false} offset={CONFIG.POST.vignetteOffset} darkness={CONFIG.POST.vignetteDarkness} />
            ),
          ].filter(Boolean)}
        </EffectComposer>
      )}
    </>
  );
}
