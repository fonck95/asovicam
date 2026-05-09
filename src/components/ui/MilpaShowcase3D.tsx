import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Leaf,
} from 'lucide-react';
import Scene from '../ProductViewer/Scene';
import { products, getProductById } from '../ProductViewer/products';
import styles from './MilpaShowcase3D.module.css';

// =====================================================
// Showcase 3D para el home: reutiliza los mismos modelos
// procedurales de /productos (Scene + products) y los
// presenta en formato "showroom" — fondo oscuro, autorotación
// entre cultivos, copy de marketing y CTA hacia el catálogo.
// =====================================================

const HIGHLIGHTS: Record<string, string[]> = {
  maiz: [
    'Variedad criolla amarilla',
    'Tutor vivo del sistema milpa',
    'Cosecha en 120 a 150 días',
  ],
  frijol: [
    'Fija nitrógeno atmosférico',
    'Mejora suelos de baja fertilidad',
    'Ciclo corto de 60 a 90 días',
  ],
  sandia: [
    'Cobertura viva del suelo',
    'Variedad Charleston Gray',
    'Cosecha dulce en 80 a 100 días',
  ],
};

const TRUST_BADGES = [
  { icon: <Leaf size={13} />, label: '100% orgánico' },
  { icon: <ShieldCheck size={13} />, label: 'Producción asociativa' },
  { icon: <Sparkles size={13} />, label: 'Yondó · Magdalena Medio' },
];

const ROTATE_MS = 6500;

export default function MilpaShowcase3D() {
  const [activeId, setActiveId] = useState(products[0].id);
  const [userTook, setUserTook] = useState(false);
  const product = getProductById(activeId);
  const highlights = HIGHLIGHTS[product.id] ?? [];

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
    <div
      className={styles.wrapper}
      style={{ ['--accent' as string]: product.color }}
    >
      <div className={styles.bgGradient} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.layout}>
        <div className={styles.canvasFrame}>
          <Scene product={product} />
          <span className={styles.hint} aria-hidden="true">
            Arrastra para rotar · Scroll para acercar
          </span>
          <span className={styles.live} aria-hidden="true">
            <span className={styles.livePulse} />
            En vivo · 3D
          </span>
        </div>

        <div className={styles.info} key={product.id}>
          <span className={styles.eyebrow}>
            <Sparkles size={12} strokeWidth={2.4} />
            {product.tagline}
          </span>

          <h3 className={styles.title}>
            {product.name}
            <span className={styles.titleAura} aria-hidden="true" />
          </h3>
          <p className={styles.scientific}>{product.scientificName}</p>

          <p className={styles.description}>{product.description}</p>

          <ul className={styles.highlights}>
            {highlights.map((h) => (
              <li key={h}>
                <CheckCircle2 size={16} strokeWidth={2.2} />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <Link to="/productos" className={styles.ctaPrimary}>
              Ver catálogo en 3D
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
            <Link to="/contacto" className={styles.ctaSecondary}>
              Solicitar cotización
            </Link>
          </div>

          <ul className={styles.trust}>
            {TRUST_BADGES.map((b) => (
              <li key={b.label}>
                <span className={styles.trustIcon}>{b.icon}</span>
                {b.label}
              </li>
            ))}
          </ul>
        </div>
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
              <span className={styles.chipDot} />
              <span className={styles.chipName}>{p.name}</span>
              <span className={styles.chipScientific}>{p.scientificName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
