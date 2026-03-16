import styles from './Gallery.module.css';

const galleryItems = [
  { id: 1, emoji: '🌽', title: 'Cultivo de maíz', description: 'Maíz criollo en pleno desarrollo' },
  { id: 2, emoji: '🫘', title: 'Frijol caupí', description: 'Vainas listas para cosecha' },
  { id: 3, emoji: '🍉', title: 'Sandía en campo', description: 'Frutos maduros entre las guías' },
  { id: 4, emoji: '🌱', title: 'Sistema milpa', description: 'Los tres cultivos en asocio' },
  { id: 5, emoji: '🧑‍🌾', title: 'Trabajo comunitario', description: 'Jornada de siembra colectiva' },
  { id: 6, emoji: '🌿', title: 'Mulch aplicado', description: 'Cobertura orgánica sobre el suelo' },
  { id: 7, emoji: '🏞️', title: 'Magdalena Medio', description: 'Paisaje del territorio' },
  { id: 8, emoji: '🤝', title: 'Asociación', description: 'Reunión de campesinos asociados' },
  { id: 9, emoji: '🌾', title: 'Cosecha', description: 'Recolección del maíz maduro' },
];

export default function Gallery() {
  return (
    <>
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
          <p className={styles.note}>
            Próximamente agregaremos fotografías reales de nuestros cultivos,
            jornadas de trabajo y actividades comunitarias. Por ahora,
            estos espacios representan las diferentes facetas de ASOVICAM.
          </p>

          <div className={styles.grid}>
            {galleryItems.map((item) => (
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
        </div>
      </section>
    </>
  );
}
