import { useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import Experience from '../components/Experience/Experience';
import {
  getProduct,
  getExperienceSections,
  isTourRoute,
} from '../components/Experience/products';

// =====================================================
// Ruta /experiencia y /experiencia/:producto — experiencia inmersiva
// scroll-driven.
//
//   • /experiencia            → RECORRIDO COMPLETO: los tres cultivos de la
//     milpa (maíz → frijol caupí → sandía) encadenados en UNA sola
//     presentación. Se desplaza de uno al siguiente sin hacer clic.
//   • /experiencia/:producto  → experiencia individual de ese cultivo
//     (deep-link directo).
//
// Se renderiza FUERA del Layout global (sin header/footer) para lograr
// la inmersión full-bleed estilo página de producto.
// =====================================================

export default function Experiencia() {
  const { producto } = useParams();
  const tour = isTourRoute(producto);
  const sections = getExperienceSections(producto);

  // SEO: el recorrido completo describe la milpa entera; el deep-link de un
  // cultivo usa su propio título y descripción.
  const product = getProduct(producto);
  const title = tour ? 'Experiencia 3D · La Milpa' : `Experiencia 3D · ${product.label}`;
  const description = tour
    ? 'Recorre en 3D la milpa de ASOVICAM en una sola presentación inmersiva: maíz criollo, frijol caupí y sandía encadenados, con cámara, luz y detalle sincronizados con tu desplazamiento.'
    : product.seoDescription;

  return (
    <>
      <SEO title={title} description={description} />
      {/* key remonta la experiencia de forma limpia al alternar entre el
          recorrido completo y un cultivo individual (reinicia canvas, scroll
          y timeline). */}
      <Experience key={tour ? 'tour' : producto} sections={sections} tour={tour} />
    </>
  );
}
