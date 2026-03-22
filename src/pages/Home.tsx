import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Users, Mountain, Sun, BookOpen, Wheat, TreePine } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import SEO from '../components/SEO';
import { crops } from '../data/crops';
import { testimonials } from '../data/testimonials';
import { programs } from '../data/programs';
import { impactStats } from '../data/impact';
import styles from './Home.module.css';

const programIcons: Record<string, React.ReactNode> = {
  leaf: <Leaf size={28} />,
  wheat: <Wheat size={28} />,
  book: <BookOpen size={28} />,
  tree: <TreePine size={28} />,
};

export default function Home() {
  return (
    <>
      <SEO
        title="Inicio"
        description="ASOVICAM - Asociación Campesina Vida en el Campo. Sistema milpa con técnica de mulch en Yondó, Antioquia. Agricultura sostenible en el Magdalena Medio colombiano."
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={`container ${styles.heroContent}`}>
          <span className={styles.heroBadge}>
            <Leaf size={16} /> Ciénaga de Barbacoas, Yondó — Magdalena Medio
          </span>
          <h1 className={styles.heroTitle}>
            Cultivando tradición,
            <br />
            <span className={styles.heroHighlight}>sembrando futuro</span>
          </h1>
          <p className={styles.heroText}>
            Somos ASOVICAM, la Asociación Campesina Vida en el Campo. Rescatamos
            el sistema ancestral de la milpa — maíz, frijol caupí y sandía —
            con técnica de mulch para una agricultura sostenible en el corazón
            del Magdalena Medio colombiano.
          </p>
          <div className={styles.heroCta}>
            <Button to="/milpa" size="lg">
              Conoce la Milpa <ArrowRight size={18} />
            </Button>
            <Button to="/nosotros" variant="outline" size="lg">
              Sobre nosotros
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">Nuestra esencia</h2>
          <p className="section__subtitle">
            Un modelo de agricultura campesina que cuida la tierra, alimenta
            comunidades y preserva el saber ancestral.
          </p>

          <div className={styles.features}>
            {[
              {
                icon: <Leaf size={32} />,
                title: 'Agricultura Sostenible',
                description:
                  'El sistema milpa con mulch regenera el suelo, conserva agua y elimina la necesidad de agroquímicos.',
              },
              {
                icon: <Users size={32} />,
                title: 'Comunidad Campesina',
                description:
                  'Más de 50 familias campesinas unidas por el amor a la tierra y la tradición agrícola del Magdalena Medio.',
              },
              {
                icon: <Mountain size={32} />,
                title: 'Territorio',
                description:
                  'Yondó, Antioquia, en el corazón del Magdalena Medio, tierra fértil donde la milpa encuentra su hogar ideal.',
              },
              {
                icon: <Sun size={32} />,
                title: 'Técnica de Mulch',
                description:
                  'La cobertura orgánica del suelo protege de la erosión, mantiene la humedad y nutre la vida microbiana.',
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
          <h2 className="section__title">Los tres pilares de la milpa</h2>
          <p className="section__subtitle">
            Maíz, frijol caupí y sandía: una alianza natural que ha alimentado
            comunidades durante generaciones.
          </p>

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

      {/* Impact Stats */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">Nuestro impacto</h2>
          <p className="section__subtitle">
            Cifras que reflejan el compromiso de ASOVICAM con la agricultura
            sostenible y la comunidad campesina.
          </p>

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
          <h2 className="section__title">Nuestros programas</h2>
          <p className="section__subtitle">
            Líneas de trabajo que fortalecen la agricultura campesina, la
            organización comunitaria y la conservación del territorio.
          </p>

          <div className={styles.programsGrid}>
            {programs.map((program) => (
              <div key={program.id} className={styles.programCard}>
                <div className={styles.programIcon}>
                  {programIcons[program.icon]}
                </div>
                <h3 className={styles.programTitle}>{program.title}</h3>
                <p className={styles.programDescription}>
                  {program.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">Voces del campo</h2>
          <p className="section__subtitle">
            Nuestros campesinos comparten su experiencia con el sistema milpa.
          </p>

          <div className={styles.testimonials}>
            {testimonials.map((t) => (
              <div key={t.id} className={styles.testimonial}>
                <blockquote className={styles.testimonialQuote}>
                  &ldquo;{t.content}&rdquo;
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
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className={styles.ctaTitle}>
            Únete a nuestra causa campesina
          </h2>
          <p className={styles.ctaText}>
            Conoce más sobre nuestro trabajo, visita nuestros cultivos o apoya
            la agricultura sostenible en el Magdalena Medio.
          </p>
          <Button to="/contacto" size="lg">
            Contáctanos <ArrowRight size={18} />
          </Button>
        </div>
      </section>
    </>
  );
}
