import { FileText } from 'lucide-react';
import SEO from '../components/SEO';
import { useContent } from '../content/ContentContext';
import type { PublicGalleryItem } from '../types/content';
import styles from './Gallery.module.css';

// Placeholders locales: se muestran mientras el CMS no tenga elementos de
// galería publicados, para que la página nunca se vea vacía.
const placeholderItems = [
  { id: 1, emoji: '🌽', title: 'Cultivo de maíz', description: 'Maíz criollo en pleno desarrollo en nuestras parcelas' },
  { id: 2, emoji: '🫘', title: 'Frijol caupí', description: 'Vainas de frijol caupí listas para cosecha' },
  { id: 3, emoji: '🍉', title: 'Sandía en campo', description: 'Frutos maduros de sandía entre las guías rastreras' },
  { id: 4, emoji: '🌱', title: 'Sistema milpa', description: 'Los tres cultivos creciendo en asocio sobre el mulch' },
  { id: 5, emoji: '🧑‍🌾', title: 'Trabajo comunitario', description: 'Jornada de siembra colectiva con familias asociadas' },
  { id: 6, emoji: '🌿', title: 'Mulch aplicado', description: 'Cobertura orgánica protegiendo el suelo entre cultivos' },
  { id: 7, emoji: '🏞️', title: 'Magdalena Medio', description: 'Paisaje del territorio y la Ciénaga de Barbacoas' },
  { id: 8, emoji: '🤝', title: 'Asociación', description: 'Reunión de campesinos asociados planificando la siembra' },
  { id: 9, emoji: '🌾', title: 'Cosecha', description: 'Recolección del maíz maduro al final del ciclo' },
];

function GalleryMedia({ media }: { media: PublicGalleryItem['media'] }) {
  if (media.kind === 'video') {
    return <video src={media.url} className={styles.cardMedia} controls preload="metadata" />;
  }
  if (media.kind === 'document') {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer" className={styles.cardDocument}>
        <FileText size={44} aria-hidden="true" />
        <span>Ver documento</span>
      </a>
    );
  }
  return <img src={media.url} alt={media.alt} className={styles.cardMedia} loading="lazy" />;
}

export default function Gallery() {
  const { gallery } = useContent();

  return (
    <>
      <SEO
        title="Galería"
        description="Galería de imágenes de ASOVICAM: cultivos de milpa, trabajo comunitario y vida campesina en Yondó, Antioquia."
      />

      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>Galería</h1>
          <p className={styles.heroSubtitle}>
            Imágenes de nuestro trabajo en el campo y la vida campesina
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {gallery.length > 0 ? (
            <div className={styles.grid}>
              {gallery.map((item) => (
                <div key={item.id} className={styles.card}>
                  <div className={styles.cardImage}>
                    <GalleryMedia media={item.media} />
                  </div>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                    <p className={styles.cardDescription}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className={styles.note}>
                Próximamente agregaremos fotografías reales de nuestros cultivos,
                jornadas de trabajo y actividades comunitarias. Por ahora,
                estos espacios representan las diferentes facetas de ASOVICAM.
              </p>

              <div className={styles.grid}>
                {placeholderItems.map((item) => (
                  <div key={item.id} className={styles.card}>
                    <div className={styles.cardImage}>
                      <span className={styles.cardEmoji}>{item.emoji}</span>
                    </div>
                    <div className={styles.cardInfo}>
                      <h3 className={styles.cardTitle}>{item.title}</h3>
                      <p className={styles.cardDescription}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
