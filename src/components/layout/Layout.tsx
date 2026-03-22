import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import styles from './Layout.module.css';

export default function Layout() {
  return (
    <div className={styles.layout}>
      <a href="#main-content" className="sr-only" style={{
        position: 'absolute',
        top: '-100%',
        left: 0,
        zIndex: 100,
        padding: '1rem',
        background: 'var(--color-primary)',
        color: 'white',
      }}>
        Ir al contenido principal
      </a>
      <Header />
      <main id="main-content" className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
