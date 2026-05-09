import { Suspense, useState } from 'react';
import Scene from './Scene';
import ProductSelector from './ProductSelector';
import InfoPanel from './InfoPanel';
import { products, getProductById } from './products';

// =====================================================
// Visor 3D de productos.
// Una sola ruta de render: modelos procedurales construidos
// con primitivas Three.js + texturas en canvas. Sin .glb,
// sin manifest, sin shaders inyectados.
// =====================================================

export default function ProductViewer() {
  const [activeId, setActiveId] = useState(products[0].id);
  const product = getProductById(activeId);

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% 0%, #ecfccb 0%, transparent 60%),' +
          'radial-gradient(900px 600px at 100% 100%, #fef3c7 0%, transparent 55%),' +
          'linear-gradient(180deg, #fafaf7 0%, #f3f1ea 100%)',
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:gap-8 lg:py-16">
        <div className="flex flex-col gap-4">
          <ProductSelector activeId={activeId} onSelect={setActiveId} />

          <div
            className="relative h-[420px] w-full overflow-hidden rounded-3xl border border-stone-200/70 bg-white/40 shadow-xl shadow-emerald-900/5 sm:h-[520px] lg:h-[600px]"
            aria-label={`Modelo 3D interactivo de ${product.name}`}
          >
            <Suspense fallback={null}>
              <Scene product={product} />
            </Suspense>

            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/70 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
              Arrastra para rotar · Scroll para acercar
            </div>
          </div>
        </div>

        <InfoPanel product={product} />
      </div>
    </section>
  );
}
