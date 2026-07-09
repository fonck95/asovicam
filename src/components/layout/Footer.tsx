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
              <span className={styles.logoMark}>
                <Sprout size={22} strokeWidth={2.25} />
              </span>
              <div>
                <div className={styles.logoName}>ASOVICAM</div>
                <div className={styles.logoTagline}>
                  Vida en el Campo
                </div>
              </div>
            </div>
            <p className={styles.footerDescription}>
              Cultivando tradición, sembrando futuro. Sistema milpa con técnica
              de mulch en el corazón del Magdalena Medio colombiano.
            </p>
          </div>

          {/* Navigation */}
          <div>
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

          {/* Explorar */}
          <div>
            <h3 className={styles.footerTitle}>Explorar</h3>
            <ul className={styles.footerLinks}>
              <li><Link to="/milpa" className={styles.footerLink}>Sistema milpa</Link></li>
              <li><Link to="/nosotros" className={styles.footerLink}>Nuestro equipo</Link></li>
              <li><Link to="/galeria" className={styles.footerLink}>Galería</Link></li>
              <li><Link to="/preguntas" className={styles.footerLink}>FAQ</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className={styles.footerTitle}>Contacto</h3>
            <ul className={styles.contactList}>
              <li className={styles.contactItem}>
                <MapPin size={16} />
                <span>Ciénaga de Barbacoas, Yondó, Antioquia</span>
              </li>
              <li className={styles.contactItem}>
                <Phone size={16} />
                <a href="tel:+573165570682">+57 316 557 0682</a>
              </li>
              <li className={styles.contactItem}>
                <Mail size={16} />
                <a href="mailto:asovicam2023@gmail.com">asovicam2023@gmail.com</a>
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
