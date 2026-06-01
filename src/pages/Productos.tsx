import { ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import styles from './Productos.module.css';

// =====================================================
// Página /productos — catálogo de los cultivos del sistema milpa.
// La exploración 3D vive ahora únicamente en /experiencia.
// =====================================================

interface ProductFact {
  label: string;
  value: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  scientificName: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  facts: ProductFact[];
}

const catalog: CatalogProduct[] = [
  {
    id: 'maiz',
    name: 'Maíz',
    scientificName: 'Zea mays',
    tagline: 'El pilar de la milpa campesina',
    description:
      'Variedad criolla adaptada al trópico húmedo del Magdalena Medio. Aporta ' +
      'la estructura vertical del sistema milpa y es la base alimentaria de la región.',
    icon: '🌽',
    color: '#f59e0b',
    facts: [
      { label: 'Variedad', value: 'Criolla amarilla' },
      { label: 'Ciclo de cultivo', value: '120 – 150 días' },
      { label: 'Región', value: 'Yondó, Antioquia' },
      { label: 'Rendimiento', value: '2.8 – 3.5 t/ha' },
    ],
  },
  {
    id: 'frijol',
    name: 'Frijol Caupí',
    scientificName: 'Vigna unguiculata',
    tagline: 'Fija nitrógeno y nutre el suelo',
    description:
      'Leguminosa tropical de ciclo corto, ideal para suelos de baja fertilidad. ' +
      'Fija nitrógeno atmosférico mejorando el suelo de forma natural.',
    icon: '🫘',
    color: '#059669',
    facts: [
      { label: 'Variedad', value: 'Caupí regional' },
      { label: 'Ciclo de cultivo', value: '60 – 90 días' },
      { label: 'Región', value: 'Magdalena Medio' },
      { label: 'Rendimiento', value: '0.9 – 1.4 t/ha' },
    ],
  },
  {
    id: 'sandia',
    name: 'Sandía',
    scientificName: 'Citrullus lanatus',
    tagline: 'Cobertura viva, cosecha dulce',
    description:
      'Cobertura rastrera que protege el suelo, conserva la humedad y entrega ' +
      'un fruto de alto valor comercial para los mercados locales.',
    icon: '🍉',
    color: '#dc2626',
    facts: [
      { label: 'Variedad', value: 'Charleston Gray' },
      { label: 'Ciclo de cultivo', value: '80 – 100 días' },
      { label: 'Región', value: 'Yondó, Antioquia' },
      { label: 'Rendimiento', value: '18 – 25 t/ha' },
    ],
  },
];

export default function Productos() {
  return (
    <>
      <SEO
        title="Productos"
        description="Conoce el maíz, frijol caupí y sandía cultivados por ASOVICAM en Yondó, Antioquia, con prácticas agroecológicas del sistema milpa."
      />

      <section
        style={{
          paddingTop: 'calc(var(--header-height) + 1rem)',
          paddingBottom: 'var(--spacing-2xl)',
          textAlign: 'center',
        }}
      >
        <div className="container">
          <span className="section__eyebrow">Catálogo</span>
          <h1 className="section__title">Nuestros productos</h1>
          <p className="section__subtitle">
            Maíz, frijol caupí y sandía cultivados con prácticas agroecológicas
            en Yondó. Tres cultivos que se complementan en el sistema milpa.
          </p>

          <div className={styles.grid}>
            {catalog.map((product) => (
              <Card
                key={product.id}
                accentColor={product.color}
                className={styles.card}
              >
                <span className={styles.icon} aria-hidden="true">
                  {product.icon}
                </span>
                <h2 className={styles.name}>{product.name}</h2>
                <p className={styles.scientific}>{product.scientificName}</p>
                <p className={styles.tagline} style={{ color: product.color }}>
                  {product.tagline}
                </p>
                <p className={styles.description}>{product.description}</p>
                <dl className={styles.facts}>
                  {product.facts.map((fact) => (
                    <div key={fact.label} className={styles.fact}>
                      <dt className={styles.factLabel}>{fact.label}</dt>
                      <dd className={styles.factValue}>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>

          <div className={styles.cta}>
            <p className={styles.ctaText}>
              ¿Quieres explorarlos en detalle y en movimiento?
            </p>
            <Button to="/experiencia" size="lg">
              Vive la Experiencia 3D <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
