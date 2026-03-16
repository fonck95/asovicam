import { useState } from 'react';
import type { FormEvent } from 'react';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import Button from '../components/ui/Button';
import type { ContactFormData } from '../types';
import styles from './Contact.module.css';

export default function Contact() {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // In production, this would send to a backend
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <>
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
                Escríbenos o visítanos en Yondó.
              </p>

              <div className={styles.contactItems}>
                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <strong>Ubicación</strong>
                    <p>Yondó, Antioquia — Magdalena Medio, Colombia</p>
                  </div>
                </div>

                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <Phone size={20} />
                  </div>
                  <div>
                    <strong>Teléfono</strong>
                    <p>+57 300 000 0000</p>
                  </div>
                </div>

                <div className={styles.contactItem}>
                  <div className={styles.contactIcon}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <strong>Correo electrónico</strong>
                    <p>contacto@asovicam.org</p>
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
                  <span className={styles.successIcon}>✅</span>
                  <h3>Mensaje enviado</h3>
                  <p>
                    Gracias por comunicarte con ASOVICAM. Te responderemos lo
                    antes posible.
                  </p>
                  <Button onClick={() => setSubmitted(false)}>
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
    </>
  );
}
