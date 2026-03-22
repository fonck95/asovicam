import Button from '../components/ui/Button';
import SEO from '../components/SEO';
import styles from './NotFound.module.css';

export default function NotFound() {
  return (
    <>
      <SEO
        title="Página no encontrada"
        description="La página que buscas no existe. Vuelve al inicio de ASOVICAM."
      />
      <section className={styles.notFound}>
        <div className="container" style={{ textAlign: 'center' }}>
          <span className={styles.emoji} role="img" aria-label="Planta">🌱</span>
          <h1 className={styles.title}>404</h1>
          <p className={styles.text}>
            Esta página no existe. Como una semilla que aún no germina, tal vez
            aún no es el momento.
          </p>
          <Button to="/" size="lg">
            Volver al inicio
          </Button>
        </div>
      </section>
    </>
  );
}
