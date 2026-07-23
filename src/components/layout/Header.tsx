import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Lock } from 'lucide-react';
import { navLinks } from '../../data/navigation';
import { ADMIN_PANEL_URL } from '../../lib/api';
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

  // Cierra el menú al navegar (incluye back/forward del navegador):
  // ajuste de estado durante el render, sin efecto.
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setIsMenuOpen(false);
  }

  // Con el menú móvil abierto: cerrar con Escape y bloquear el scroll de fondo.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMenuOpen]);

  const mainLinks = navLinks.filter((link) => link.path !== '/contacto');
  const contactLink = navLinks.find((link) => link.path === '/contacto');

  return (
    <header
      className={`${styles.header} ${isScrolled ? styles.headerScrolled : ''}`}
    >
      <div className={`container ${styles.headerInner}`}>
        <Link to="/" className={styles.logo} onClick={closeMenu} aria-label="ASOVICAM — Inicio">
          <picture className={styles.logoPicture}>
            <source
              type="image/avif"
              srcSet="/img/asovicam-logo-128.avif 128w, /img/asovicam-logo-256.avif 256w, /img/asovicam-logo-384.avif 384w"
              sizes="180px"
            />
            <source
              type="image/webp"
              srcSet="/img/asovicam-logo-128.webp 128w, /img/asovicam-logo-256.webp 256w, /img/asovicam-logo-384.webp 384w"
              sizes="180px"
            />
            <img
              src="/img/asovicam-logo-256.webp"
              alt="ASOVICAM — Asociación Vida en el Campo"
              className={styles.logoImage}
              width="180"
              height="52"
              decoding="async"
            />
          </picture>
        </Link>

        <nav
          id="main-nav"
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
                  aria-current={location.pathname === link.path ? 'page' : undefined}
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
                  aria-current={location.pathname === contactLink.path ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  {contactLink.label}
                </Link>
              </li>
            )}
            <li>
              {/* Navegación de página completa al panel same-origin con la
                  API: la sesión (cookie SameSite=Lax) solo vive allí. */}
              <a
                href={ADMIN_PANEL_URL}
                className={styles.navLogin}
                aria-label="Iniciar sesión — acceso administradores"
                onClick={closeMenu}
              >
                <Lock size={14} aria-hidden="true" />
                Iniciar sesión
              </a>
            </li>
          </ul>
        </nav>

        <button
          className={styles.menuToggle}
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-controls="main-nav"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </header>
  );
}
