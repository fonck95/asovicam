import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

// =====================================================
// Overlay de carga: visible solo mientras drei está cargando
// recursos externos (Environment HDR, etc.). Como los modelos
// ahora son 100% procedurales, este loader normalmente solo
// aparece un instante al montar la escena.
// =====================================================

export default function Loader() {
  const { active, progress } = useProgress();
  // Pequeño retraso para no parpadear cuando la carga es instantánea.
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(t);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50/85 via-stone-50/85 to-amber-50/85 backdrop-blur-sm transition-opacity duration-300">
      <div className="flex w-56 flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-800">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
          </span>
          <span className="text-sm font-medium tracking-wide">
            Preparando escena 3D…
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(8, progress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
