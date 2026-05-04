import { useProgress } from '@react-three/drei';

// =====================================================
// Overlay de carga con barra de progreso real
// usando `useProgress` de drei. Aparece sobre el canvas
// mientras se descarga el .glb.
// =====================================================

export default function Loader() {
  const { active, progress, item } = useProgress();

  if (!active && progress === 100) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50/90 via-stone-50/90 to-amber-50/90 backdrop-blur-sm transition-opacity duration-300">
      <div className="flex w-64 flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-800">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
          </span>
          <span className="text-sm font-medium tracking-wide">
            Cargando modelo 3D…
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex w-full items-center justify-between text-[11px] text-emerald-900/60">
          <span className="truncate">{item ? item.split('/').pop() : ''}</span>
          <span className="font-mono">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}
