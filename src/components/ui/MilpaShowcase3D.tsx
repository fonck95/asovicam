import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import Scene from '../ProductViewer/Scene';
import { products, getProductById } from '../ProductViewer/products';
import styles from './MilpaShowcase3D.module.css';

// =====================================================
// Showcase 3D editorial: reutiliza los mismos modelos
// procedurales de /productos y los presenta a escala
// completa con tipografía editorial y métricas de impacto.
// Autorrota cada 7s hasta que el usuario interactúa.
// =====================================================

const HIGHLIGHTS: Record<string, { label: string; value: string }[]> = {
  maiz: [
    { label: 'Variedad', value: 'Criolla amarilla' },
    { label: 'Función', value: 'Tutor del sistema milpa' },
    { label: 'Ciclo', value: '120 a 150 días' },
  ],
  frijol: [
    { label: 'Variedad', value: 'Caupí regional' },
    { label: 'Función', value: 'Fija nitrógeno atmosférico' },
    { label: 'Ciclo', value: '60 a 90 días' },
  ],
  sandia: [
    { label: 'Variedad', value: 'Charleston Gray' },
    { label: 'Función', value: 'Cobertura viva del suelo' },
    { label: 'Ciclo', value: '80 a 100 días' },
  ],
};

const STATS = [
  { value: '50+', label: 'Familias campesinas' },
  { value: '120 ha', label: 'Bajo cultivo asociativo' },
  { value: '100%', label: 'Producción orgánica' },
];

const ROTATE_MS = 7000;

export default function MilpaShowcase3D() {
  const [activeId, setActiveId] = useState(products[0].id);
  const [userTook, setUserTook] = useState(false);
  const product = getProductById(activeId);
  const facts = HIGHLIGHTS[product.id] ?? [];

  useEffect(() => {
    if (userTook) return;
    const id = window.setInterval(() => {
      setActiveId((prev) => {
        const i = products.findIndex((p) => p.id === prev);
        return products[(i + 1) % products.length].id;
      });
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [userTook]);

  return (
    <section
      className={styles.section}
      style={{ ['--accent' as string]: product.color }}
      data-active={product.id}
    >
      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgAccent} aria-hidden="true" />
      <div className={styles.bgGrain} aria-hidden="true" />
      <div className={styles.bgVignette} aria-hidden="true" />

      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>
            <Sparkles size={12} strokeWidth={2.4} />
            Catálogo agrícola en 3D
          </span>
          <h2 className={styles.kicker}>
            Tres cultivos.{' '}
            <span className={styles.kickerHighlight}>Una milpa viva.</span>
          </h2>
          <p className={styles.lede}>
            Maíz, frijol caupí y sandía cultivados con prácticas agroecológicas
            en el corazón del Magdalena Medio. Modelos reales, interactivos,
            que puedes rotar y acercar.
          </p>
        </header>

        <div className={styles.grid}>
          <div className={styles.canvasWrap}>
            <div className={styles.canvasFrame}>
              <Scene product={product} />
              <span className={styles.live} aria-hidden="true">
                <span className={styles.livePulse} />
                En vivo · 3D
              </span>
              <span className={styles.hint} aria-hidden="true">
                Arrastra para rotar · Scroll para acercar
              </span>
            </div>

            <ul className={styles.stats}>
              {STATS.map((s) => (
                <li key={s.label}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <article className={styles.detail} key={product.id}>
            <div className={styles.detailHead}>
              <span className={styles.tagline}>{product.tagline}</span>
              <h3 className={styles.title}>{product.name}</h3>
              <p className={styles.scientific}>{product.scientificName}</p>
            </div>

            <p className={styles.description}>{product.description}</p>

            <dl className={styles.facts}>
              {facts.map((f) => (
                <div key={f.label} className={styles.factRow}>
                  <dt>
                    <CheckCircle2 size={14} strokeWidth={2.4} />
                    {f.label}
                  </dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className={styles.actions}>
              <Link to="/productos" className={styles.ctaPrimary}>
                Ver catálogo en 3D
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
              <Link to="/contacto" className={styles.ctaSecondary}>
                Solicitar cotización
              </Link>
            </div>
          </article>
        </div>

        <div className={styles.chips} role="tablist" aria-label="Selecciona un cultivo">
          {products.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
                style={{ ['--chipAccent' as string]: p.color }}
                onClick={() => {
                  setActiveId(p.id);
                  setUserTook(true);
                }}
              >
                <span className={styles.chipIndex}>
                  0{products.findIndex((x) => x.id === p.id) + 1}
                </span>
                <span className={styles.chipBody}>
                  <span className={styles.chipName}>{p.name}</span>
                  <span className={styles.chipScientific}>
                    {p.scientificName}
                  </span>
                </span>
                <span className={styles.chipDot} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
