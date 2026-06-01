import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SECTIONS } from './sections';
import styles from './Experience.module.css';

// =====================================================
// Overlay HTML: las secciones de texto que scrollean SOBRE el canvas fijo.
// Cada <section> mide ~1 pantallazo y lleva id `exp-<id>` (lo consulta el
// hook para crear los ScrollTrigger). Los elementos [data-reveal] son los
// que el scroll anima al entrar.
//
// El canvas 3D vive detrás (position: fixed); aquí solo va tipografía,
// mucho espacio negativo y el CTA final. Estética premium oscura.
// =====================================================

export default function Overlay() {
  // Punto activo del indicador lateral (decoupled del 3D, vía IntersectionObserver).
  const [active, setActive] = useState(0);
  const sectionsRef = useRef([]);

  useEffect(() => {
    const els = sectionsRef.current.filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.overlay}>
      {/* Barra superior minimal (sustituye al header global en modo inmersivo). */}
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand}>ASOVICAM</Link>
        <Link to="/productos" className={styles.topLink}>Catálogo&nbsp;→</Link>
      </header>

      {SECTIONS.map((s, i) => (
        <section
          key={s.id}
          id={`exp-${s.id}`}
          ref={(el) => { sectionsRef.current[i] = el; }}
          data-index={i}
          className={styles.section}
          data-align={s.align}
        >
          <div className={styles.copy}>
            <span className={styles.eyebrow} data-reveal>{s.eyebrow}</span>
            <h2 className={styles.title} data-reveal>{s.title}</h2>
            <p className={styles.body} data-reveal>{s.body}</p>

            {(s.cta || s.cta2) && (
              <div className={styles.ctaRow} data-reveal>
                {s.cta && (
                  <Link to={s.cta.href} className={styles.ctaPrimary}>{s.cta.label}</Link>
                )}
                {s.cta2 && (
                  <Link to={s.cta2.href} className={styles.ctaGhost}>{s.cta2.label}</Link>
                )}
              </div>
            )}
          </div>

          {i === 0 && (
            <div className={styles.scrollCue} data-reveal aria-hidden>
              <span>Desplázate</span>
              <span className={styles.scrollTrack}><span className={styles.scrollThumb} /></span>
            </div>
          )}
        </section>
      ))}

      {/* Indicador de progreso por secciones. */}
      <nav className={styles.dots} aria-hidden>
        {SECTIONS.map((s, i) => (
          <span key={s.id} className={styles.dot} data-active={i === active} />
        ))}
      </nav>
    </div>
  );
}
