import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCTS } from './products';
import styles from './Experience.module.css';

// =====================================================
// Overlay HTML: las secciones de texto que scrollean SOBRE el canvas fijo.
// Cada <section> mide ~1 pantallazo y lleva id `exp-<id>` (lo consulta el
// hook para crear los ScrollTrigger). Los elementos [data-reveal] son los
// que el scroll anima al entrar.
//
// El canvas 3D vive detrás (position: fixed); aquí solo va tipografía,
// mucho espacio negativo, el SELECTOR DE CULTIVO y el CTA final.
//
// `sections` viene normalizado (cada una con `productId`). Dos modos:
//   • RECORRIDO (`tour`): los tres cultivos encadenados. El switcher SALTA
//     dentro de la misma página al hero de cada cultivo (sin recargar) y se
//     resalta el cultivo que el scroll tiene en pantalla. Los puntos muestran
//     solo las secciones del cultivo activo (recorrido limpio aunque haya 21).
//   • INDIVIDUAL: un solo cultivo; el switcher navega al deep-link de otro.
// =====================================================

export default function Overlay({ sections, tour = false, onJump }) {
  // Sección centrada (índice GLOBAL en `sections`), vía IntersectionObserver.
  const [activeIdx, setActiveIdx] = useState(0);
  const sectionsRef = useRef([]);

  useEffect(() => {
    const els = sectionsRef.current.filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index);
            if (!Number.isNaN(idx)) setActiveIdx(idx);
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  // Cultivo activo según el scroll (productId de la sección centrada).
  const activeProductId = sections[activeIdx]?.productId ?? PRODUCTS[0].id;

  // Primera sección (índice global) de cada cultivo → destino del salto.
  const cropStarts = useMemo(() => {
    const map = {};
    sections.forEach((s, i) => {
      if (s.productId != null && map[s.productId] === undefined) map[s.productId] = i;
    });
    return map;
  }, [sections]);

  // Puntos: solo las secciones del cultivo activo (así el indicador no se
  // dispara a 21 puntos en el recorrido; muestra el avance dentro del cultivo).
  const cropSections = useMemo(
    () => sections.filter((s) => s.productId === activeProductId),
    [sections, activeProductId],
  );
  const cropLocalActive = activeIdx - (cropStarts[activeProductId] ?? 0);

  return (
    <div className={styles.overlay}>
      {/* Barra superior minimal (sustituye al header global en modo inmersivo). */}
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand}>ASOVICAM</Link>

        {/* Selector de cultivo. En recorrido salta dentro de la página; en
            individual navega al deep-link. El cultivo activo queda resaltado. */}
        <nav className={styles.switcher} aria-label="Elegir cultivo">
          {PRODUCTS.map((p) => {
            const isActive = p.id === activeProductId;
            const inner = (
              <>
                <span className={styles.switchIcon} aria-hidden="true">{p.icon}</span>
                <span className={styles.switchLabel}>{p.label}</span>
              </>
            );
            if (tour) {
              const startIdx = cropStarts[p.id] ?? 0;
              const targetId = sections[startIdx]?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={styles.switchBtn}
                  data-active={isActive}
                  aria-current={isActive ? 'true' : undefined}
                  title={p.label}
                  onClick={() => onJump?.(targetId)}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={p.id}
                to={`/experiencia/${p.id}`}
                className={styles.switchBtn}
                data-active={isActive}
                aria-current={isActive ? 'page' : undefined}
                title={p.label}
              >
                {inner}
              </Link>
            );
          })}
        </nav>

        <Link to="/productos" className={styles.topLink}>Catálogo&nbsp;→</Link>
      </header>

      {sections.map((s, i) => (
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

      {/* Indicador de progreso del cultivo activo. */}
      <nav className={styles.dots} aria-hidden>
        {cropSections.map((s, i) => (
          <span key={s.id} className={styles.dot} data-active={i === cropLocalActive} />
        ))}
      </nav>
    </div>
  );
}
