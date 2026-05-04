import SEO from '../components/SEO';
import ProductViewer from '../components/ProductViewer';

// =====================================================
// Página /productos — host del visor 3D interactivo.
// =====================================================

export default function Productos() {
  return (
    <>
      <SEO
        title="Productos en 3D"
        description="Explora en 3D el maíz, frijol y sandía cultivados por ASOVICAM en Yondó, Antioquia. Rota, acerca y conoce cada producto del sistema milpa."
      />

      <section
        style={{
          paddingTop: 'calc(var(--header-height) + 1rem)',
          paddingBottom: 'var(--spacing-2xl)',
          textAlign: 'center',
        }}
      >
        <div className="container">
          <span className="section__eyebrow">Catálogo interactivo</span>
          <h1 className="section__title">Nuestros productos en 3D</h1>
          <p className="section__subtitle">
            Maíz, frijol caupí y sandía cultivados con prácticas agroecológicas
            en Yondó. Arrastra el modelo para rotarlo y haz scroll para acercarte.
          </p>
        </div>
      </section>

      <ProductViewer />
    </>
  );
}
