import { Heart, Target, Eye, Users, TreePine, Handshake, Award, UserCircle } from 'lucide-react';
import SEO from '../components/SEO';
import { useContent } from '../content/ContentContext';
import styles from './About.module.css';

export default function About() {
  const { teamMembers } = useContent();

  return (
    <>
      <SEO
        title="Sobre Nosotros"
        description="Conoce la historia, misión, visión y valores de ASOVICAM. Más de 50 familias campesinas unidas por la agricultura sostenible en Yondó, Antioquia."
      />

      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>Sobre ASOVICAM</h1>
          <p className={styles.heroSubtitle}>
            Asociación Campesina Vida en el Campo — Yondó, Antioquia
          </p>
        </div>
      </section>

      {/* History */}
      <section className="section">
        <div className="container">
          <div className={styles.content}>
            <div className={styles.textBlock}>
              <h2 className={styles.sectionTitle}>Nuestra historia</h2>
              <p>
                ASOVICAM nació del corazón del Magdalena Medio, en el municipio
                de Yondó, Antioquia, donde familias campesinas decidieron unir
                sus fuerzas para rescatar las prácticas agrícolas tradicionales
                y construir un modelo de vida digna en el campo.
              </p>
              <p>
                Nuestra asociación se fundamenta en el sistema de la milpa — la
                siembra conjunta de maíz, frijol caupí y sandía — potenciada con
                la técnica de mulch, una cobertura orgánica que protege y nutre
                el suelo de manera natural.
              </p>
              <p>
                En un territorio marcado por la riqueza natural del Magdalena
                Medio, ASOVICAM representa la resistencia pacífica del
                campesinado, demostrando que es posible producir alimentos sanos
                mientras se cuida la tierra para las futuras generaciones.
              </p>
              <p>
                Con el tiempo, hemos logrado consolidar una red de más de 50
                familias que trabajan en 120 hectáreas de tierra, produciendo
                alimentos orgánicos y fortaleciendo la economía local a través
                de ferias campesinas y bancos de semillas criollas.
              </p>
            </div>
            <div className={styles.statsGrid}>
              {[
                { number: '50+', label: 'Familias campesinas' },
                { number: '120', label: 'Hectáreas cultivadas' },
                { number: '3', label: 'Cultivos en milpa' },
                { number: '100%', label: 'Orgánico y sostenible' },
              ].map((stat) => (
                <div key={stat.label} className={styles.statCard}>
                  <span className={styles.statNumber}>{stat.number}</span>
                  <span className={styles.statLabel}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="section section--alt">
        <div className="container">
          <div className={styles.missionGrid}>
            <div className={styles.missionCard}>
              <div className={styles.missionIcon}>
                <Target size={32} />
              </div>
              <h3 className={styles.missionTitle}>Misión</h3>
              <p>
                Promover la agricultura sostenible y la soberanía alimentaria en
                el Magdalena Medio a través del sistema milpa con técnica de
                mulch, fortaleciendo la economía campesina, la organización
                comunitaria y la conservación del medio ambiente en Yondó,
                Antioquia.
              </p>
            </div>

            <div className={styles.missionCard}>
              <div className={styles.missionIcon}>
                <Eye size={32} />
              </div>
              <h3 className={styles.missionTitle}>Visión</h3>
              <p>
                Ser una asociación campesina referente en el Magdalena Medio y
                Colombia, reconocida por su modelo de producción agroecológica
                basado en la milpa, que garantice la seguridad alimentaria, la
                dignidad del campesino y la conservación del territorio para las
                futuras generaciones.
              </p>
            </div>
          </div>

          <h3 className={styles.valuesTitle}>Nuestros valores</h3>
          <div className={styles.valuesGrid}>
            {[
              {
                icon: <Heart size={24} />,
                title: 'Amor por la tierra',
                description: 'Cultivamos con respeto y gratitud hacia la naturaleza que nos sustenta.',
              },
              {
                icon: <Users size={24} />,
                title: 'Comunidad',
                description: 'El trabajo colectivo y la solidaridad campesina son nuestra fuerza.',
              },
              {
                icon: <TreePine size={24} />,
                title: 'Sostenibilidad',
                description: 'Producimos hoy pensando en las generaciones del mañana.',
              },
              {
                icon: <Handshake size={24} />,
                title: 'Solidaridad',
                description: 'Compartimos saberes, semillas y cosechas con quienes más lo necesitan.',
              },
              {
                icon: <Award size={24} />,
                title: 'Dignidad campesina',
                description: 'Reivindicamos el valor del trabajo rural y la vida en el campo.',
              },
              {
                icon: <Target size={24} />,
                title: 'Soberanía alimentaria',
                description: 'Decidimos qué sembrar, cómo producir y a quién alimentar.',
              },
            ].map((value) => (
              <div key={value.title} className={styles.valueCard}>
                <div className={styles.valueIcon}>{value.icon}</div>
                <h4 className={styles.valueTitle}>{value.title}</h4>
                <p className={styles.valueDescription}>{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">Nuestro equipo</h2>
          <p className="section__subtitle">
            Las personas que lideran y sostienen el trabajo de ASOVICAM
            en el territorio.
          </p>

          <div className={styles.teamGrid}>
            {teamMembers.map((member) => (
              <div key={member.id} className={styles.teamCard}>
                <div className={styles.teamAvatar}>
                  {member.photo ? (
                    <img
                      src={member.photo.url}
                      alt={member.photo.alt || member.name}
                      className={styles.teamPhoto}
                      loading="lazy"
                    />
                  ) : (
                    <UserCircle size={48} />
                  )}
                </div>
                <h3 className={styles.teamName}>{member.name}</h3>
                <span className={styles.teamRole}>{member.role}</span>
                <p className={styles.teamDescription}>{member.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Territory */}
      <section className="section section--alt">
        <div className="container">
          <h2 className="section__title">Nuestro territorio</h2>
          <p className="section__subtitle">
            Ciénaga de Barbacoas, Yondó, Antioquia — en el corazón del Magdalena Medio colombiano
          </p>
          <div className={styles.territory}>
            <div className={styles.territoryInfo}>
              <p>
                El municipio de Yondó se encuentra ubicado en el margen
                oriental del departamento de Antioquia, a orillas del río
                Magdalena. Con un clima tropical cálido y húmedo, suelos
                fértiles y abundantes fuentes de agua, nuestro territorio es
                ideal para el desarrollo del sistema milpa.
              </p>
              <p>
                La región del Magdalena Medio se caracteriza por su
                biodiversidad excepcional, sus ciénagas y humedales, y una
                tradición campesina y pesquera que ha sostenido a las
                comunidades durante generaciones. La Ciénaga de Barbacoas es
                uno de los ecosistemas más importantes de la zona, hogar de
                diversas especies de aves, peces y flora nativa.
              </p>
              <ul className={styles.territoryList}>
                <li><strong>Ubicación:</strong> Ciénaga de Barbacoas, Yondó, Antioquia</li>
                <li><strong>Región:</strong> Magdalena Medio</li>
                <li><strong>Clima:</strong> Tropical cálido y húmedo (28-35°C)</li>
                <li><strong>Altitud:</strong> 75-150 msnm</li>
                <li><strong>Suelos:</strong> Aluviales fértiles del río Magdalena</li>
                <li><strong>Hidrografía:</strong> Río Magdalena, ciénagas y humedales</li>
              </ul>
            </div>
            <div className={styles.territoryMap}>
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
        </div>
      </section>
    </>
  );
}
