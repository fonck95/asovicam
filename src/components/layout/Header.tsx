import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sprout } from 'lucide-react';
import { navLinks } from '../../data/navigation';
import styles from './Header.module.css';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link to="/" className={styles.logo} onClick={closeMenu}>
          <Sprout className={styles.logoIcon} size={32} />
          <div className={styles.logoText}>
            <span className={styles.logoName}>ASOVICAM</span>
            <span className={styles.logoTagline}>Vida en el Campo</span>
          </div>
        </Link>

        <nav
          className={`${styles.nav} ${isMenuOpen ? styles.navOpen : ''}`}
          aria-label="Navegación principal"
        >
          <ul className={styles.navList}>
            {navLinks.map((link) => (
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
