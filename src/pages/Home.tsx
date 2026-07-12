import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Leaf,
  Users,
  Mountain,
  Sun,
  BookOpen,
  Wheat,
  TreePine,
  Sparkles,
  Heart,
  Lock,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Product3DGallery, {
  type ProductSlide,
} from '../components/ui/Product3DGallery';
import HeroGpuCanvas from '../components/ui/HeroGpuCanvas';
import SEO from '../components/SEO';

import { useContent } from '../content/ContentContext';
import { ADMIN_PANEL_URL } from '../lib/api';
import styles from './Home.module.css';

// Slides locales de respaldo: se muestran mientras el CMS no tenga slides
// de portada publicados (colección homeSlides vacía).
const localSlides: ProductSlide[] = [
  {
    id: 'milpa',
    title: 'Milpa viva',
    subtitle: 'Maíz · Frijol caupí · Sandía',
    description:
      'Tres cultivos en una sola parcela: el maíz como tutor, el frijol que fija nitrógeno y la sandía que tapiza el suelo. Una alianza ancestral, productiva y regenerativa.',
    image: '/milpa.jpg',
    badge: 'Producto insignia',
    accent: 'var(--color-primary)',
  },
  {
    id: 'siembra',
    title: 'Ciclo de siembra',
    subtitle: 'Del terreno a la cosecha',
    description:
      'Seis pasos cuidadosamente escalonados: preparación, siembra del maíz, asociación con frijol y sandía, mulch continuo y cosecha en cascada a lo largo del año.',
    image: '/steps-milpa.jpg',
    badge: 'Proceso',
    accent: 'var(--color-secondary-light)',
  },
];

const programIcons: Record<string, React.ReactNode> = {
  leaf: <Leaf size={24} />,
  wheat: <Wheat size={24} />,
  book: <BookOpen size={24} />,
  tree: <TreePine size={24} />,
};

export default function Home() {
  const { settings, crops, testimonials, programs, impactStats, homeSlides } =
    useContent();
  const { hero } = settings;

  const productSlides: ProductSlide[] = homeSlides.length
    ? homeSlides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        subtitle: slide.subtitle,
        description: slide.description,
        image: slide.image.url,
        badge: slide.badge,
        accent: slide.accent,
      }))
    : localSlides;

  return (
    <>
      <SEO
        title="Inicio"
        description="ASOVICAM - Asociación Campesina Vida en el Campo. Sistema milpa con técnica de mulch en Yondó, Antioquia. Agricultura sostenible en el Magdalena Medio colombiano."
      />

      {/* Hero */}
      <section className={styles.hero}>
        <HeroGpuCanvas />
        <div className={styles.heroOverlay} />
        <div className={`container ${styles.heroContent}`}>
          <span className={styles.heroBadge}>
            <span className={styles.heroBadgeDot}>
              <Leaf size={12} strokeWidth={2.5} />
            </span>
            {hero.badge}
          </span>
          <h1 className={styles.heroTitle}>
            {hero.title}
            <br />
            <span className={styles.heroHighlight}>{hero.highlight}</span>
          </h1>
          <p className={styles.heroText}>{hero.subtitle}</p>
          <div className={styles.heroCta}>
            <Button to="/milpa" size="lg">
              Conoce la Milpa <ArrowRight size={18} />
            </Button>
            <Button to="/nosotros" variant="outline" size="lg">
              Sobre nosotros
            </Button>
          </div>

          <div className={styles.heroMeta}>
            <div className={styles.heroMetaItem}>
              <span className={styles.heroMetaValue}>50+</span>
              <span className={styles.heroMetaLabel}>Familias</span>
            </div>
            <div className={styles.heroMetaItem}>
              <span className={styles.heroMetaValue}>120 ha</span>
              <span className={styles.heroMetaLabel}>Cultivadas</span>
            </div>
            <div className={styles.heroMetaItem}>
              <span className={styles.heroMetaValue}>100%</span>
              <span className={styles.heroMetaLabel}>Orgánico</span>
            </div>
          </div>
        </div>

        <span className={styles.heroScroll} aria-hidden="true">
          Scroll
        </span>
      </section>

      {/* Features */}
      <section className="section">
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>
              <Sparkles size={12} /> Nuestra esencia
            </span>
            <h2 className="section__title">Un modelo que cuida la tierra</h2>
            <p className="section__subtitle">
              Agricultura campesina que regenera el suelo, alimenta comunidades
              y preserva el saber ancestral del Magdalena Medio.
            </p>
          </div>

          <div className={styles.features}>
            {[
              {
                icon: <Leaf size={26} />,
                title: 'Agricultura Sostenible',
                description:
                  'El sistema milpa con mulch regenera el suelo, conserva agua y elimina la necesidad de agroquímicos.',
              },
              {
                icon: <Users size={26} />,
                title: 'Comunidad Campesina',
                description:
                  'Más de 50 familias campesinas unidas por el amor a la tierra y la tradición agrícola.',
              },
              {
                icon: <Mountain size={26} />,
                title: 'Territorio',
                description:
                  'Yondó, Antioquia, en el corazón del Magdalena Medio, tierra fértil donde la milpa florece.',
              },
              {
                icon: <Sun size={26} />,
                title: 'Técnica de Mulch',
                description:
                  'Cobertura orgánica que protege de la erosión, retiene humedad y nutre la vida microbiana.',
              },
            ].map((feature) => (
              <div key={feature.title} className={styles.featureItem}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Crops Preview */}
      <section className="section section--alt">
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>
              <Wheat size={12} /> Sistema milpa
            </span>
            <h2 className="section__title">Los tres pilares de la milpa</h2>
            <p className="section__subtitle">
              Maíz, frijol caupí y sandía: una alianza natural que ha alimentado
              comunidades durante generaciones.
            </p>
          </div>

          <div className={styles.cropsGrid}>
            {crops.map((crop) => (
              <Card key={crop.id} accentColor={crop.color}>
                <span className={styles.cropIcon}>{crop.icon}</span>
                <h3 className={styles.cropName}>{crop.name}</h3>
                <p className={styles.cropScientific}>{crop.scientificName}</p>
                <p className={styles.cropDescription}>{crop.description}</p>
                <Link to="/milpa" className={styles.cropLink}>
                  Saber más <ArrowRight size={14} />
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Product Showcase — 3D scroll gallery */}
      <section className={`section ${styles.showcase}`}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>
              <Sparkles size={12} /> Nuestro producto
            </span>
            <h2 className="section__title">Mira la milpa de cerca</h2>
            <p className="section__subtitle">
              Imágenes reales de nuestros cultivos en Yondó. Pasa el cursor sobre
              cada tarjeta para verlas con perspectiva — optimizadas en tu
              dispositivo con WebGPU.
            </p>
          </div>

          <Product3DGallery slides={productSlides} />
        </div>
      </section>

      {/* Impact Stats */}
      <section className="section">
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>
              <Heart size={12} /> Nuestro impacto
            </span>
            <h2 className="section__title">Cifras que reflejan compromiso</h2>
            <p className="section__subtitle">
              Resultados tangibles del trabajo colectivo en agricultura
              sostenible y fortalecimiento comunitario.
            </p>
          </div>

          <div className={styles.impactGrid}>
            {impactStats.map((stat) => (
              <div key={stat.id} className={styles.impactCard}>
                <span className={styles.impactValue}>{stat.value}</span>
                <span className={styles.impactLabel}>{stat.label}</span>
                <p className={styles.impactDesc}>{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="section section--alt">
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>
              <BookOpen size={12} /> Líneas de trabajo
            </span>
            <h2 className="section__title">Nuestros programas</h2>
            <p className="section__subtitle">
              Iniciativas que fortalecen la agricultura campesina, la
              organización comunitaria y la conservación del territorio.
            </p>
          </div>

          <div className={styles.programsGrid}>
            {programs.map((program) => (
              <div key={program.id} className={styles.programCard}>
                <div className={styles.programIcon}>
                  {programIcons[program.icon] ?? <Leaf size={24} />}
                </div>
                <div className={styles.programBody}>
                  <h3 className={styles.programTitle}>{program.title}</h3>
                  <p className={styles.programDescription}>
                    {program.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section">
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow}>
              <Users size={12} /> Voces del campo
            </span>
            <h2 className="section__title">Lo que dicen nuestras familias</h2>
            <p className="section__subtitle">
              Testimonios reales de campesinos y campesinas que viven el
              sistema milpa cada día.
            </p>
          </div>

          <div className={styles.testimonials}>
            {testimonials.map((t) => (
              <div key={t.id} className={styles.testimonial}>
                <div className={styles.testimonialQuoteMark} aria-hidden="true">
                  &ldquo;
                </div>
                <blockquote className={styles.testimonialQuote}>
                  {t.content}
                </blockquote>
                <div className={styles.testimonialAuthor}>
                  <strong>{t.author}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className="container">
          <div className={styles.ctaInner}>
            <span className={styles.ctaEyebrow}>
              <Heart size={12} /> Únete
            </span>
            <h2 className={styles.ctaTitle}>
              Apoya la causa campesina del Magdalena Medio
            </h2>
            <p className={styles.ctaText}>
              Conoce nuestro trabajo, visita los cultivos o suma tu voz al
              movimiento por una agricultura digna y sostenible.
            </p>
            <Button to="/contacto" size="lg">
              Contáctanos <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* Acceso administradores: navegación de página completa al panel
          same-origin con la API (la sesión solo funciona en ese dominio). */}
      <section className={styles.adminAccess}>
        <div className="container">
          <div className={styles.adminAccessCard}>
            <div className={styles.adminAccessIcon}>
              <Lock size={20} aria-hidden="true" />
            </div>
            <div className={styles.adminAccessBody}>
              <h2 className={styles.adminAccessTitle}>
                Acceso para administradores
              </h2>
              <p className={styles.adminAccessText}>
                ¿Haces parte del equipo de ASOVICAM? Ingresa al panel para
                gestionar el contenido del sitio, los asociados, los mapas y
                los sorteos de lotes.
              </p>
            </div>
            <Button href={ADMIN_PANEL_URL} variant="outline">
              Iniciar sesión <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
