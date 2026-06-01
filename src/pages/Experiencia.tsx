import SEO from '../components/SEO';
import Experience from '../components/Experience/Experience';

// =====================================================
// Ruta /experiencia — experiencia inmersiva scroll-driven.
// Se renderiza FUERA del Layout global (sin header/footer) para
// lograr la inmersión full-bleed estilo página de producto.
// =====================================================

export default function Experiencia() {
  return (
    <>
      <SEO
        title="Experiencia 3D"
        description="Recorre en 3D el maíz criollo de ASOVICAM con una experiencia inmersiva scroll-driven: cámara, luz y detalle sincronizados con tu desplazamiento."
      />
      <Experience />
    </>
  );
}
