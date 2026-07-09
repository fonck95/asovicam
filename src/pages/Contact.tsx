import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import Button from '../components/ui/Button';
import SEO from '../components/SEO';
import { useContactForm } from '../hooks/useContactForm';
import styles from './Contact.module.css';

export default function Contact() {
  const { formData, submitted, handleChange, handleSubmit, reset } = useContactForm();

  return (
    <>
      <SEO
        title="Contacto"
        description="Contacta a ASOVICAM. Escríbenos para información, visitas a cultivos, alianzas o compra de productos orgánicos en Yondó, Antioquia."
      />

      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>Contacto</h1>
          <p className={styles.heroSubtitle}>
            Estamos abiertos a colaboraciones, visitas y alianzas
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.grid}>
            {/* Contact Info */}
            <div className={styles.info}>
              <h2 className={styles.infoTitle}>Hablemos</h2>
              <p className={styles.infoText}>
                ¿Quieres conocer más sobre nuestro proyecto? ¿Te interesa
                visitar nuestros cultivos o explorar posibilidades de apoyo?
                Escríbenos o visítanos en la Ciénaga de Barbacoas, Yondó.
              </p>

              <div className={styles.contactItems}>
                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <strong>Ubicación</strong>
                    <p>Ciénaga de Barbacoas, Yondó, Antioquia — Magdalena Medio, Colombia</p>
                  </div>
                </div>

                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <Phone size={20} />
                  </div>
                  <div>
                    <strong>Teléfono</strong>
                    <p><a href="tel:+573165570682">+57 316 557 0682</a></p>
                  </div>
                </div>

                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <strong>Correo electrónico</strong>
                    <p><a href="mailto:asovicam2023@gmail.com">asovicam2023@gmail.com</a></p>
                    <p><a href="mailto:biojulian20@gmail.com">biojulian20@gmail.com</a></p>
                  </div>
                </div>

                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <strong>Horario</strong>
                    <p>Lunes a Viernes: 7:00 AM - 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className={styles.formWrapper}>
              {submitted ? (
                <div className={styles.success}>
                  <span className={styles.successIcon} role="img" aria-label="Enviado">&#9989;</span>
                  <h3>Mensaje listo para enviar</h3>
                  <p>
                    Abrimos tu aplicación de correo con el mensaje redactado;
                    solo falta que lo envíes. Si no se abrió, escríbenos
                    directamente a{' '}
                    <a href="mailto:asovicam2023@gmail.com">asovicam2023@gmail.com</a>.
                    Gracias por comunicarte con ASOVICAM.
                  </p>
                  <Button onClick={reset}>
                    Enviar otro mensaje
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <h3 className={styles.formTitle}>Envíanos un mensaje</h3>

                  <div className={styles.formGroup}>
                    <label htmlFor="name" className={styles.label}>
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className={styles.input}
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="email" className={styles.label}>
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className={styles.input}
                      placeholder="tu@correo.com"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="subject" className={styles.label}>
                      Asunto
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className={styles.input}
                    >
                      <option value="">Selecciona un asunto</option>
                      <option value="info">Información general</option>
                      <option value="visita">Visitar nuestros cultivos</option>
                      <option value="alianza">Alianza o colaboración</option>
                      <option value="compra">Compra de productos</option>
                      <option value="asociarse">Asociarse a ASOVICAM</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="message" className={styles.label}>
                      Mensaje
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className={styles.textarea}
                      placeholder="Cuéntanos en qué podemos ayudarte..."
                    />
                  </div>

                  <Button type="submit" size="lg">
                    <Send size={16} /> Enviar mensaje
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="section section--alt">
        <div className="container">
          <h2 className="section__title">Nuestra ubicación</h2>
          <p className="section__subtitle">
            Ciénaga de Barbacoas, Yondó, Antioquia — Magdalena Medio
          </p>
          <div className={styles.mapContainer}>
            <iframe
              src="https://www.google.com/maps/d/u/0/embed?mid=1pR7tb0-RpiB08RRk2XKuMbFzAxtBeEY&ehbc=2E312F"
              className={styles.mapEmbed}
              title="Mapa de ASOVICAM - Ciénaga de Barbacoas, Yondó"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </>
  );
}
