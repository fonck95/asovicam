import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import styles from './Experience.module.css';

// =====================================================
// Loader premium. Cubre la pantalla hasta que la escena está lista y
// se desvanece revelando el hero.
//   • Con .glb (assets externos) → sigue el progreso real de drei.
//   • Con modelos procedurales (sin assets) → no hay nada que esperar,
//     así que mostramos un breve barrido elegante mientras se construye
//     la geometría en el primer frame.
// =====================================================

export default function ProgressLoader() {
  const { active, progress, total } = useProgress();
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [fill, setFill] = useState(8);
  const rafRef = useRef(0);

  // Barra: progreso real si hay assets; si no, barrido a 100%.
  useEffect(() => {
    if (total > 0) {
      setFill(Math.max(8, progress));
    } else {
      rafRef.current = requestAnimationFrame(() => setFill(100));
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [progress, total]);

  // "Listo": nada cargando. Damos un delay mínimo para que el primer frame
  // (y la construcción procedural) ya estén pintados antes de revelar.
  useEffect(() => {
    if (active) return undefined;
    const delay = total > 0 ? 450 : 750;
    const t = setTimeout(() => setDone(true), delay);
    return () => clearTimeout(t);
  }, [active, total]);

  // Desmonta tras la transición de salida.
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setHidden(true), 700);
    return () => clearTimeout(t);
  }, [done]);

  if (hidden) return null;

  return (
    <div className={styles.loader} data-done={done} role="status" aria-live="polite">
      <div className={styles.loaderInner}>
        <span className={styles.loaderMark}>ASOVICAM</span>
        <div className={styles.loaderBar}>
          <div className={styles.loaderFill} style={{ width: `${fill}%` }} />
        </div>
        <span className={styles.loaderHint}>
          {total > 0 ? `Cargando modelo · ${Math.round(progress)}%` : 'Preparando escena 3D'}
        </span>
      </div>
    </div>
  );
}
