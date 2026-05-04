import { CheckCircle, Layers, Droplets, Bug, Recycle } from 'lucide-react';
import Card from '../components/ui/Card';
import GpuImage from '../components/ui/GpuImage';
import SEO from '../components/SEO';
import { crops } from '../data/crops';
import styles from './Milpa.module.css';

export default function Milpa() {
  return (
    <>
      <SEO
        title="El Sistema Milpa"
        description="Conoce el sistema milpa de ASOVICAM: maíz, frijol caupí y sandía con técnica de mulch. Agricultura agroecológica ancestral en Yondó, Antioquia."
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>El Sistema Milpa</h1>
          <p className={styles.heroSubtitle}>
            Maíz, frijol caupí y sandía en armonía — potenciados con técnica de mulch
          </p>
        </div>
      </section>

      {/* What is Milpa */}
      <section className="section">
        <div className="container">
          <div className={styles.introMedia}>
            <GpuImage
              src="/milpa.jpg"
              alt="Sistema milpa de ASOVICAM en Yondó: maíz, frijol caupí y sandía cultivados en armonía con técnica de mulch."
              maxWidth={1280}
              aspectRatio="16 / 9"
              eager
            />
            <figcaption className={styles.introCaption}>
              Cultivo asociado de maíz, frijol caupí y sandía en parcelas de
              ASOVICAM &mdash; Ciénaga de Barbacoas, Yondó.
            </figcaption>
          </div>

          <div className={styles.intro}>
            <h2 className={styles.sectionTitle}>
              ¿Qué es la milpa?
            </h2>
            <p>
              La milpa es un sistema de cultivo ancestral mesoamericano basado en
              la siembra asociada de múltiples especies que se complementan
              mutuamente. En ASOVICAM, hemos adaptado este sistema al territorio
              del Magdalena Medio, combinando <strong>maíz</strong>,{' '}
              <strong>frijol caupí</strong> y <strong>sandía</strong> en un
              modelo agroecológico potenciado con la técnica de mulch.
            </p>
            <p>
              A diferencia del monocultivo convencional, la milpa imita los
              ecosistemas naturales: cada planta cumple una función específica
              que beneficia al conjunto, creando un ciclo virtuoso de nutrientes,
              protección y productividad. Este modelo ancestral ha demostrado ser
              más resiliente al cambio climático y más productivo por hectárea
              que el monocultivo.
            </p>
          </div>
        </div>
      </section>

      {/* Crops Detail */}
      <section className="section section--alt">
        <div className="container">
          <h2 className="section__title">Los tres cultivos</h2>
          <p className="section__subtitle">
            Cada especie cumple un rol fundamental en el equilibrio del sistema
          </p>

          <div className={styles.cropsDetail}>
            {crops.map((crop) => (
              <Card key={crop.id} accentColor={crop.color}>
                <div className={styles.cropHeader}>
                  <span className={styles.cropIcon}>{crop.icon}</span>
                  <div>
                    <h3 className={styles.cropName}>{crop.name}</h3>
                    <p className={styles.cropScientific}>{crop.scientificName}</p>
                  </div>
                </div>
                <p className={styles.cropDescription}>{crop.description}</p>
                <h4 className={styles.benefitsTitle}>Beneficios:</h4>
                <ul className={styles.benefitsList}>
                  {crop.benefits.map((benefit) => (
                    <li key={benefit} className={styles.benefitItem}>
                      <CheckCircle size={16} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Synergy */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">Sinergia de la milpa</h2>
          <p className="section__subtitle">
            Cómo los tres cultivos se benefician mutuamente
          </p>

          <div className={styles.synergyGrid}>
            <div className={styles.synergyCard}>
              <h3 className={styles.synergyTitle}>Maíz + Frijol Caupí</h3>
              <p className={styles.synergyDesc}>
                El maíz proporciona la estructura vertical que el frijol utiliza como
                tutor natural para trepar. A cambio, el frijol caupí fija nitrógeno
                atmosférico al suelo a través de bacterias en sus raíces (Rhizobium),
                aportando fertilidad natural que beneficia al maíz y reduce la
                necesidad de fertilizantes.
              </p>
            </div>
            <div className={styles.synergyCard}>
              <h3 className={styles.synergyTitle}>Sandía + Maíz</h3>
              <p className={styles.synergyDesc}>
                Las amplias hojas rastreras de la sandía cubren el suelo entre las
                hileras de maíz, actuando como cobertura viva que reduce la
                evaporación del agua, suprime el crecimiento de malezas y protege
                el suelo de la erosión por lluvia directa.
              </p>
            </div>
            <div className={styles.synergyCard}>
              <h3 className={styles.synergyTitle}>Los tres juntos</h3>
              <p className={styles.synergyDesc}>
                El resultado es un sistema que produce tres tipos de alimentos
                simultáneamente, mejora la fertilidad del suelo en cada ciclo, requiere
                menos agua e insumos, y es más resiliente a plagas porque la diversidad
                rompe los ciclos de los insectos perjudiciales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mulch Technique */}
      <section className="section section--alt">
        <div className="container">
          <h2 className="section__title">Técnica de Mulch</h2>
          <p className="section__subtitle">
            La cobertura orgánica que potencia nuestro sistema milpa
          </p>

          <div className={styles.mulchContent}>
            <div className={styles.mulchText}>
              <p>
                El mulch o acolchado consiste en cubrir el suelo con una capa
                de materia orgánica (hojas secas, restos de cosecha, pasto
                cortado) que actúa como una manta protectora. En combinación
                con la milpa, esta técnica multiplica los beneficios del
                sistema.
              </p>
              <p>
                En el clima cálido y húmedo de Yondó, el mulch es especialmente
                valioso: reduce la evaporación del agua hasta en un 70%, mantiene
                la temperatura del suelo estable y alimenta la vida microbiana
                que descompone la materia orgánica en nutrientes disponibles
                para las plantas.
              </p>
            </div>

            <div className={styles.mulchBenefits}>
              {[
                {
                  icon: <Layers size={28} />,
                  title: 'Protección del suelo',
                  description: 'Evita la erosión por lluvia y viento, conservando la capa fértil.',
                },
                {
                  icon: <Droplets size={28} />,
                  title: 'Retención de humedad',
                  description: 'Reduce la evaporación y mantiene el suelo húmedo por más tiempo.',
                },
                {
                  icon: <Bug size={28} />,
                  title: 'Control de arvenses',
                  description: 'Suprime el crecimiento de malezas al bloquear la luz solar.',
                },
                {
                  icon: <Recycle size={28} />,
                  title: 'Fertilidad natural',
                  description: 'Al descomponerse, aporta nutrientes orgánicos al suelo.',
                },
              ].map((benefit) => (
                <div key={benefit.title} className={styles.mulchBenefitCard}>
                  <div className={styles.mulchBenefitIcon}>{benefit.icon}</div>
                  <div>
                    <h4 className={styles.mulchBenefitTitle}>{benefit.title}</h4>
                    <p className={styles.mulchBenefitDesc}>{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">El proceso de siembra</h2>
          <p className="section__subtitle">
            Paso a paso, así establecemos nuestra milpa en Yondó
          </p>

          <div className={styles.processMedia}>
            <GpuImage
              src="/steps-milpa.jpg"
              alt="Pasos de siembra de la milpa: preparación del terreno, siembra escalonada de maíz, frijol caupí y sandía, y mantenimiento con mulch."
              maxWidth={1280}
              aspectRatio="16 / 9"
            />
            <figcaption className={styles.introCaption}>
              De la preparación del terreno a la cosecha escalonada &mdash; el
              ciclo completo de la milpa con mulch.
            </figcaption>
          </div>

          <div className={styles.process}>
            {[
              {
                step: '01',
                title: 'Preparación del terreno',
                description:
                  'Se limpia el terreno sin quemar, conservando la materia orgánica. Se aplica la primera capa de mulch sobre el suelo.',
              },
              {
                step: '02',
                title: 'Siembra del maíz',
                description:
                  'Se siembra el maíz en hileras con distancias de 80-100 cm. El maíz será el eje estructural del sistema.',
              },
              {
                step: '03',
                title: 'Siembra del frijol caupí',
                description:
                  'Dos semanas después del maíz, se siembra el frijol entre las hileras. Utilizará el maíz como tutor natural.',
              },
              {
                step: '04',
                title: 'Siembra de la sandía',
                description:
                  'Se siembra la sandía en los espacios más amplios. Sus guías rastreras cubrirán el suelo como cobertura viva.',
              },
              {
                step: '05',
                title: 'Mantenimiento con mulch',
                description:
                  'Se mantiene y renueva la capa de mulch durante todo el ciclo, aportando materia orgánica y protegiendo el suelo.',
              },
              {
                step: '06',
                title: 'Cosecha escalonada',
                description:
                  'Primero el frijol (60-90 días), luego la sandía (80-100 días) y finalmente el maíz (120-150 días).',
              },
            ].map((item) => (
              <div key={item.step} className={styles.processStep}>
                <span className={styles.processNumber}>{item.step}</span>
                <div>
                  <h3 className={styles.processTitle}>{item.title}</h3>
                  <p className={styles.processDescription}>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
