import { useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import Experience from '../components/Experience/Experience';
import { getProduct } from '../components/Experience/products';

// =====================================================
// Ruta /experiencia y /experiencia/:producto — experiencia inmersiva
// scroll-driven. Funciona para TODOS los cultivos de la milpa (maíz,
// frijol caupí y sandía); el slug de la URL elige cuál protagoniza.
//
// Se renderiza FUERA del Layout global (sin header/footer) para lograr
// la inmersión full-bleed estilo página de producto.
// =====================================================

export default function Experiencia() {
  const { producto } = useParams();
  const product = getProduct(producto);

  return (
    <>
      <SEO
        title={`Experiencia 3D · ${product.label}`}
        description={product.seoDescription}
      />
      {/* key=product.id remonta la experiencia al cambiar de cultivo:
          reinicia canvas, scroll y timeline de forma limpia. */}
      <Experience key={product.id} productId={product.id} />
    </>
  );
}
