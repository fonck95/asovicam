import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sprout } from 'lucide-react';
import { navLinks } from '../../data/navigation';
import styles from './Header.module.css';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const mainLinks = navLinks.filter((link) => link.path !== '/contacto');
  const contactLink = navLinks.find((link) => link.path === '/contacto');

  return (
    <header
      className={`${styles.header} ${isScrolled ? styles.headerScrolled : ''}`}
    >
      <div className={`container ${styles.headerInner}`}>
        <Link to="/" className={styles.logo} onClick={closeMenu} aria-label="ASOVICAM — Inicio">
          <span className={styles.logoMark}>
            <Sprout size={22} strokeWidth={2.25} />
          </span>
          <span className={styles.logoText}>
            <span className={styles.logoName}>ASOVICAM</span>
            <span className={styles.logoTagline}>Vida en el Campo</span>
          </span>
        </Link>

        <nav
          className={`${styles.nav} ${isMenuOpen ? styles.navOpen : ''}`}
          aria-label="Navegación principal"
        >
          <ul className={styles.navList}>
            {mainLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={`${styles.navLink} ${
                    location.pathname === link.path ? styles.navLinkActive : ''
                  }`}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {contactLink && (
              <li>
                <Link
                  to={contactLink.path}
                  className={styles.navCta}
                  onClick={closeMenu}
                >
                  {contactLink.label}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <button
          className={styles.menuToggle}
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>
  );
}
