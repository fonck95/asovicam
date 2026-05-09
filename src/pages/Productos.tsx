import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Leaf,
  ShieldCheck,
  Mountain,
  Heart,
} from 'lucide-react';
import SEO from '../components/SEO';
import ProductViewer from '../components/ProductViewer';
import styles from './Productos.module.css';

// =====================================================
// Página /productos — catálogo agrícola interactivo en 3D.
// Hero con copy de marketing + visor 3D + CTA de cierre.
// =====================================================

const TRUST_BADGES = [
  { icon: <Leaf size={13} />, label: '100% orgánico' },
  { icon: <ShieldCheck size={13} />, label: 'Producción asociativa' },
  { icon: <Mountain size={13} />, label: 'Yondó · Magdalena Medio' },
];

export default function Productos() {
  return (
    <>
      <SEO
        title="Productos en 3D"
        description="Explora en 3D el maíz, frijol caupí y sandía cultivados por ASOVICAM en Yondó, Antioquia. Rota, acerca y conoce cada producto del sistema milpa."
      />

      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroInner}>
            <span className={styles.eyebrow}>
              <Sparkles size={12} strokeWidth={2.4} />
              Catálogo interactivo
            </span>
            <h1 className={styles.title}>
              Cosechas que <span className={styles.titleAccent}>cuentan historias</span>
            </h1>
            <p className={styles.subtitle}>
              Maíz, frijol caupí y sandía cultivados con prácticas agroecológicas
              en el corazón del Magdalena Medio. Arrastra los modelos para
              rotarlos, haz scroll para acercarte y descubre cada cultivo en
              detalle.
            </p>
            <ul className={styles.badges}>
              {TRUST_BADGES.map((b) => (
                <li key={b.label}>
                  <span className={styles.badgeIcon}>{b.icon}</span>
                  {b.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ProductViewer />

      <section className={styles.cta}>
        <div className="container">
          <div className={styles.ctaInner}>
            <span className={styles.ctaEyebrow}>
              <Heart size={12} strokeWidth={2.4} />
              Producción asociativa Yondó
            </span>
            <h2 className={styles.ctaTitle}>
              Lleva la milpa a tu mesa, a tu negocio o a tu programa
            </h2>
            <p className={styles.ctaText}>
              Trabajamos con familias campesinas, mercados locales y aliados
              institucionales. Cuéntanos qué necesitas y armamos juntos el
              calendario de producción y entrega.
            </p>
            <div className={styles.ctaActions}>
              <Link to="/contacto" className={styles.ctaPrimary}>
                Solicitar cotización
                <ArrowRight size={16} strokeWidth={2.4} />
              </Link>
              <Link to="/milpa" className={styles.ctaSecondary}>
                Conoce el sistema milpa
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
