import { Link } from 'react-router-dom';
import {
  Sprout,
  MapPin,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  Music2,
  MessageCircle,
} from 'lucide-react';
import { navLinks } from '../../data/navigation';
import { useContent } from '../../content/ContentContext';
import styles from './Footer.module.css';

const socialIcons = [
  { key: 'facebook', label: 'Facebook', icon: <Facebook size={16} /> },
  { key: 'instagram', label: 'Instagram', icon: <Instagram size={16} /> },
  { key: 'youtube', label: 'YouTube', icon: <Youtube size={16} /> },
  { key: 'tiktok', label: 'TikTok', icon: <Music2 size={16} /> },
  { key: 'x', label: 'X (Twitter)', icon: <Twitter size={16} /> },
] as const;

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { settings } = useContent();
  const { contact, social } = settings;
  const socialLinks = socialIcons.filter(({ key }) => social[key]);

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
            {socialLinks.length > 0 && (
              <div className={styles.socialRow}>
                {socialLinks.map(({ key, label, icon }) => (
                  <a
                    key={key}
                    href={social[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={styles.socialLink}
                  >
                    {icon}
                  </a>
                ))}
              </div>
            )}
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
                <span>{contact.address}</span>
              </li>
              <li className={styles.contactItem}>
                <Phone size={16} />
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>{contact.phone}</a>
              </li>
              <li className={styles.contactItem}>
                <Mail size={16} />
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
              {contact.whatsapp && (
                <li className={styles.contactItem}>
                  <MessageCircle size={16} />
                  <a
                    href={`https://wa.me/${contact.whatsapp.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
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
