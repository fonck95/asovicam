// =====================================================
// Panel lateral con información del producto activo.
// En móvil se muestra debajo del canvas.
// =====================================================

export default function InfoPanel({ product }) {
  return (
    <aside
      key={product.id}
      className="flex h-full flex-col gap-5 rounded-3xl border border-stone-200/70 bg-white/80 p-6 shadow-sm backdrop-blur-sm animate-[fadeIn_0.5s_ease]"
      aria-live="polite"
    >
      <header className="flex flex-col gap-1">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{
            color: product.color,
            backgroundColor: `${product.color}1a`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: product.color }}
          />
          {product.tagline}
        </span>

        <h2 className="font-serif text-3xl font-semibold tracking-tight text-stone-900">
          {product.name}
        </h2>
        <p className="text-sm italic text-stone-500">
          {product.scientificName}
        </p>
      </header>

      <p className="text-[15px] leading-relaxed text-stone-700">
        {product.description}
      </p>

      <dl className="grid grid-cols-2 gap-3">
        {product.facts.map((fact) => (
          <div
            key={fact.label}
            className="rounded-xl border border-stone-200/70 bg-stone-50/60 px-3 py-2.5"
          >
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              {fact.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-stone-800">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button
          type="button"
          className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all duration-300 hover:bg-emerald-800 hover:shadow-emerald-900/30 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />
          Solicitar cotización
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
        <p className="text-center text-[11px] text-stone-500">
          Sin compromiso · Producción asociativa Yondó
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </aside>
  );
}
