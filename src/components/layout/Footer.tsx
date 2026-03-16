import { Link } from 'react-router-dom';
import { Sprout, MapPin, Phone, Mail } from 'lucide-react';
import { navLinks } from '../../data/navigation';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerGrid}>
          {/* Brand */}
          <div className={styles.footerBrand}>
            <div className={styles.logo}>
              <Sprout size={28} />
              <div>
                <div className={styles.logoName}>ASOVICAM</div>
                <div className={styles.logoTagline}>
                  Asociación Campesina Vida en el Campo
                </div>
              </div>
            </div>
            <p className={styles.footerDescription}>
              Cultivando tradición, sembrando futuro. Sistema milpa con técnica
              de mulch en el corazón del Magdalena Medio.
            </p>
          </div>

          {/* Navigation */}
          <div className={styles.footerSection}>
            <h3 className={styles.footerTitle}>Navegación</h3>
            <ul className={styles.footerLinks}>
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className={styles.footerLink}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className={styles.footerSection}>
            <h3 className={styles.footerTitle}>Contacto</h3>
            <ul className={styles.contactList}>
              <li className={styles.contactItem}>
                <MapPin size={16} />
                <span>Yondó, Antioquia — Magdalena Medio</span>
              </li>
              <li className={styles.contactItem}>
                <Phone size={16} />
                <span>+57 300 000 0000</span>
              </li>
              <li className={styles.contactItem}>
                <Mail size={16} />
                <span>contacto@asovicam.org</span>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>
            &copy; {currentYear} ASOVICAM. Todos los derechos reservados.
          </p>
          <p className={styles.footerCredits}>
            Hecho con amor por el campo colombiano
          </p>
        </div>
      </div>
    </footer>
  );
}
