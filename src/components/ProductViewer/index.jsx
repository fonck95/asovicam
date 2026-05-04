import { Suspense, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import Scene from './Scene';
import ProductSelector from './ProductSelector';
import InfoPanel from './InfoPanel';
import { products, getProductById } from './products';

// =====================================================
// Componente principal exportable: visor 3D de productos.
// Layout responsive: canvas a la izquierda + panel a la
// derecha en desktop; apilados en móvil.
// =====================================================

// Comprueba si los .glb están realmente disponibles. Si no,
// activa los fallbacks primitivos para que el visor funcione
// desde el primer `npm run dev`.
async function checkModelsAvailable() {
  try {
    const checks = await Promise.all(
      products.map((p) =>
        fetch(p.modelPath, { method: 'HEAD' })
          .then((r) => r.ok && Number(r.headers.get('content-length')) > 1024)
          .catch(() => false),
      ),
    );
    return checks.every(Boolean);
  } catch {
    return false;
  }
}

export default function ProductViewer() {
  const [activeId, setActiveId] = useState(products[0].id);
  const [useFallback, setUseFallback] = useState(true);

  const product = getProductById(activeId);

  useEffect(() => {
    let cancelled = false;
    checkModelsAvailable().then((ok) => {
      if (cancelled) return;
      setUseFallback(!ok);
      if (ok) {
        // Precargar los tres modelos para transiciones rápidas
        products.forEach((p) => useGLTF.preload(p.modelPath));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        // Gradiente sutil verde-crema acorde a marca agrícola
        background:
          'radial-gradient(1200px 600px at 20% 0%, #ecfccb 0%, transparent 60%),' +
          'radial-gradient(900px 600px at 100% 100%, #fef3c7 0%, transparent 55%),' +
          'linear-gradient(180deg, #fafaf7 0%, #f3f1ea 100%)',
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:gap-8 lg:py-16">
        {/* Columna izquierda: selector + canvas */}
        <div className="flex flex-col gap-4">
          <ProductSelector activeId={activeId} onSelect={setActiveId} />

          <div
            className="relative h-[420px] w-full overflow-hidden rounded-3xl border border-stone-200/70 bg-white/40 shadow-xl shadow-emerald-900/5 sm:h-[520px] lg:h-[600px]"
            aria-label={`Modelo 3D interactivo de ${product.name}`}
          >
            {/* Suspense fallback para transición entre productos */}
            <Suspense fallback={null}>
              <Scene product={product} useFallback={useFallback} />
            </Suspense>

            {/* Hint de interacción */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/70 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
              Arrastra para rotar · Scroll para acercar
            </div>

            {useFallback && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-emerald-50/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-300">
                Modelo procedural HD
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: panel de info */}
        <InfoPanel product={product} />
      </div>
    </section>
  );
}
