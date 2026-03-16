import Button from '../components/ui/Button';
import styles from './NotFound.module.css';

export default function NotFound() {
  return (
    <section className={styles.notFound}>
      <div className="container" style={{ textAlign: 'center' }}>
        <span className={styles.emoji}>🌱</span>
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
  );
}
