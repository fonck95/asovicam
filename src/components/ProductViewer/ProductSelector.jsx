import { products } from './products';

// =====================================================
// Tarjetas de selección de producto.
// El producto activo recibe un anillo y degradado de color.
// =====================================================

const EMOJI = {
  maiz: '🌽',
  frijol: '🫘',
  sandia: '🍉',
};

export default function ProductSelector({ activeId, onSelect }) {
  return (
    <div
      role="tablist"
      aria-label="Productos agrícolas"
      className="flex w-full gap-2 sm:gap-3"
    >
      {products.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(p.id)}
            className={[
              'group relative flex-1 overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all duration-300',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
              active
                ? 'border-emerald-700/30 bg-white shadow-lg shadow-emerald-900/10 scale-[1.02]'
                : 'border-stone-200/70 bg-white/60 hover:bg-white hover:shadow-md',
            ].join(' ')}
          >
            {/* Barra de color del producto */}
            <span
              aria-hidden
              className={[
                'absolute inset-x-0 top-0 h-1 bg-gradient-to-r transition-opacity duration-300',
                p.accent,
                active ? 'opacity-100' : 'opacity-30 group-hover:opacity-60',
              ].join(' ')}
            />

            <div className="flex items-center gap-2 sm:gap-3">
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-300',
                  active ? 'scale-110' : 'group-hover:scale-105',
                ].join(' ')}
                style={{ backgroundColor: `${p.color}1a` }}
              >
                {EMOJI[p.id] ?? '🌱'}
              </span>
              <div className="min-w-0">
                <div
                  className={[
                    'text-sm font-semibold tracking-tight transition-colors',
                    active ? 'text-stone-900' : 'text-stone-700',
                  ].join(' ')}
                >
                  {p.name}
                </div>
                <div className="truncate text-[11px] italic text-stone-500">
                  {p.scientificName}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
