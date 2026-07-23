import { useRef } from 'react';
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
import { useHomeMotion } from '../hooks/useHomeMotion';
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
  const pageRef = useRef<HTMLDivElement>(null);
  const { settings, crops, testimonials, programs, impactStats, homeSlides } =
    useContent();
  const { hero } = settings;
  useHomeMotion(pageRef);

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

      <div ref={pageRef} className={styles.page}>

      {/* Hero */}
      <section className={styles.hero} data-home-hero>
        <picture
          className={styles.heroBackdrop}
          aria-hidden="true"
          data-hero-backdrop
        >
          <source
            type="image/avif"
            srcSet="/img/hero-territorio-480.avif 480w, /img/hero-territorio-960.avif 960w, /img/hero-territorio-1440.avif 1440w, /img/hero-territorio-1920.avif 1920w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/img/hero-territorio-480.webp 480w, /img/hero-territorio-960.webp 960w, /img/hero-territorio-1440.webp 1440w, /img/hero-territorio-1920.webp 1920w"
            sizes="100vw"
          />
          <img src="/img/hero-territorio-1920.webp" alt="" fetchPriority="high" />
        </picture>
        <HeroGpuCanvas className={styles.heroGpu} intensity={0.35} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroFilmstrip} aria-hidden="true">
          <figure
            className={`${styles.heroFrame} ${styles.heroFrameOne}`}
            data-hero-frame
          >
            <picture>
              <source
                type="image/avif"
                srcSet="/img/hero-recorrido-320.avif 320w, /img/hero-recorrido-640.avif 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <source
                type="image/webp"
                srcSet="/img/hero-recorrido-320.webp 320w, /img/hero-recorrido-640.webp 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <img src="/img/hero-recorrido-640.webp" alt="" decoding="async" />
            </picture>
          </figure>
          <figure
            className={`${styles.heroFrame} ${styles.heroFrameTwo}`}
            data-hero-frame
          >
            <picture>
              <source
                type="image/avif"
                srcSet="/img/hero-camino-320.avif 320w, /img/hero-camino-640.avif 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <source
                type="image/webp"
                srcSet="/img/hero-camino-320.webp 320w, /img/hero-camino-640.webp 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <img src="/img/hero-camino-640.webp" alt="" decoding="async" />
            </picture>
          </figure>
          <figure
            className={`${styles.heroFrame} ${styles.heroFrameThree}`}
            data-hero-frame
          >
            <picture>
              <source
                type="image/avif"
                srcSet="/img/hero-siembra-320.avif 320w, /img/hero-siembra-640.avif 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <source
                type="image/webp"
                srcSet="/img/hero-siembra-320.webp 320w, /img/hero-siembra-640.webp 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <img src="/img/hero-siembra-640.webp" alt="" decoding="async" />
            </picture>
          </figure>
          <figure
            className={`${styles.heroFrame} ${styles.heroFrameFour}`}
            data-hero-frame
          >
            <picture>
              <source
                type="image/avif"
                srcSet="/img/hero-cultivo-320.avif 320w, /img/hero-cultivo-640.avif 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <source
                type="image/webp"
                srcSet="/img/hero-cultivo-320.webp 320w, /img/hero-cultivo-640.webp 640w"
                sizes="(max-width: 1024px) 22vw, 280px"
              />
              <img src="/img/hero-cultivo-640.webp" alt="" decoding="async" />
            </picture>
          </figure>
        </div>
        <div className={`container ${styles.heroContent}`}>
          <span className={styles.heroCoordinates} data-hero-reveal>
            Yondó, Antioquia · 7°00′N 73°55′O
          </span>
          <span className={styles.heroBadge} data-hero-reveal>
            <span className={styles.heroBadgeDot}>
              <Leaf size={12} strokeWidth={2.5} />
            </span>
            {hero.badge}
          </span>
          <h1 className={styles.heroTitle} data-hero-reveal>
            {hero.title}
            <br />
            <span className={styles.heroHighlight}>{hero.highlight}</span>
          </h1>
          <p className={styles.heroText} data-hero-reveal>{hero.subtitle}</p>
          <div className={styles.heroCta} data-hero-reveal>
            <Button to="/milpa" size="lg">
              Conoce la Milpa <ArrowRight size={18} />
            </Button>
            <Button to="/nosotros" variant="outline" size="lg">
              Sobre nosotros
            </Button>
          </div>

          <div className={styles.heroCropList} data-hero-reveal>
            <span>Maíz</span>
            <span>Frijol caupí</span>
            <span>Sandía</span>
          </div>

          <div className={styles.heroMeta} data-hero-reveal>
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

        <span
          className={styles.heroScroll}
          aria-hidden="true"
          data-hero-scroll
        >
          Scroll
        </span>
      </section>

      <div className={styles.fieldNote} aria-label="Principios de ASOVICAM">
        <div className={styles.fieldNoteTrack} data-marquee-track>
          {[0, 1].map((group) => (
            <div className={styles.fieldNoteGroup} key={group} aria-hidden={group === 1}>
              {[
                'Tierra viva',
                'Semillas criollas',
                'Agua protegida',
                'Saber campesino',
                'Cosecha diversa',
                'Comunidad fuerte',
              ].map((item) => (
                <span key={item}>
                  <Leaf size={14} aria-hidden="true" /> {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className={`section ${styles.essence}`} data-reveal-section>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow} data-reveal-heading>
              <Sparkles size={12} /> Nuestra esencia
            </span>
            <h2 className="section__title" data-reveal-heading>Un modelo que cuida la tierra</h2>
            <p className="section__subtitle" data-reveal-heading>
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
              <div key={feature.title} className={styles.featureItem} data-reveal-item>
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
      <section className={`section section--alt ${styles.cropsSection}`} data-reveal-section>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow} data-reveal-heading>
              <Wheat size={12} /> Sistema milpa
            </span>
            <h2 className="section__title" data-reveal-heading>Los tres pilares de la milpa</h2>
            <p className="section__subtitle" data-reveal-heading>
              Maíz, frijol caupí y sandía: una alianza natural que ha alimentado
              comunidades durante generaciones.
            </p>
          </div>

          <div className={styles.cropsGrid}>
            {crops.map((crop) => (
              <div key={crop.id} className={styles.cropCardMotion} data-reveal-item>
              <Card accentColor={crop.color}>
                <span className={styles.cropIcon}>{crop.icon}</span>
                <h3 className={styles.cropName}>{crop.name}</h3>
                <p className={styles.cropScientific}>{crop.scientificName}</p>
                <p className={styles.cropDescription}>{crop.description}</p>
                <Link to="/milpa" className={styles.cropLink}>
                  Saber más <ArrowRight size={14} />
                </Link>
              </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Showcase — 3D scroll gallery */}
      <section className={`section ${styles.showcase}`} data-reveal-section>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow} data-reveal-heading>
              <Sparkles size={12} /> Nuestro producto
            </span>
            <h2 className="section__title" data-reveal-heading>Mira la milpa de cerca</h2>
            <p className="section__subtitle" data-reveal-heading>
              Imágenes reales de nuestros cultivos en Yondó. Cada pantalla recibe
              el formato y tamaño más liviano que necesita; WebGPU completa el
              revelado cuando el dispositivo lo permite.
            </p>
          </div>

          <div data-reveal-item>
            <Product3DGallery slides={productSlides} />
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className={`section ${styles.impactSection}`} data-reveal-section>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow} data-reveal-heading>
              <Heart size={12} /> Nuestro impacto
            </span>
            <h2 className="section__title" data-reveal-heading>Cifras que reflejan compromiso</h2>
            <p className="section__subtitle" data-reveal-heading>
              Resultados tangibles del trabajo colectivo en agricultura
              sostenible y fortalecimiento comunitario.
            </p>
          </div>

          <div className={styles.impactGrid}>
            {impactStats.map((stat) => (
              <div key={stat.id} className={styles.impactCard} data-reveal-item>
                <span className={styles.impactValue} data-counter>{stat.value}</span>
                <span className={styles.impactLabel}>{stat.label}</span>
                <p className={styles.impactDesc}>{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="section section--alt" data-reveal-section>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow} data-reveal-heading>
              <BookOpen size={12} /> Líneas de trabajo
            </span>
            <h2 className="section__title" data-reveal-heading>Nuestros programas</h2>
            <p className="section__subtitle" data-reveal-heading>
              Iniciativas que fortalecen la agricultura campesina, la
              organización comunitaria y la conservación del territorio.
            </p>
          </div>

          <div className={styles.programsGrid}>
            {programs.map((program) => (
              <div key={program.id} className={styles.programCard} data-reveal-item>
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
      <section className={`section ${styles.voicesSection}`} data-reveal-section>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.eyebrow} data-reveal-heading>
              <Users size={12} /> Voces del campo
            </span>
            <h2 className="section__title" data-reveal-heading>Lo que dicen nuestras familias</h2>
            <p className="section__subtitle" data-reveal-heading>
              Testimonios reales de campesinos y campesinas que viven el
              sistema milpa cada día.
            </p>
          </div>

          <div className={styles.testimonials}>
            {testimonials.map((t) => (
              <div key={t.id} className={styles.testimonial} data-reveal-item>
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
      <section className={styles.cta} data-reveal-section>
        <div className="container">
          <div className={styles.ctaInner} data-reveal-item>
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
      </div>
    </>
  );
}
