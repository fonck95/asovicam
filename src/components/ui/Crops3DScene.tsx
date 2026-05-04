import { useEffect, useRef, useState, type ReactElement } from 'react';
import styles from './Crops3DScene.module.css';

type CropKey = 'maiz' | 'sandia' | 'frijol';

interface CropDef {
  key: CropKey;
  label: string;
  scientific: string;
  tagline: string;
  accent: string;
  accentSoft: string;
  illustration: (active: boolean) => ReactElement;
}

function CornIllustration({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 200 320" className={styles.svg} aria-hidden="true">
      <defs>
        <linearGradient id="cornStalk" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6da347" />
          <stop offset="100%" stopColor="#3f6a26" />
        </linearGradient>
        <linearGradient id="cornCob" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="cornHusk" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a3c977" />
          <stop offset="100%" stopColor="#5e8a36" />
        </linearGradient>
        <radialGradient id="cornGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {active && <circle cx="100" cy="160" r="110" fill="url(#cornGlow)" />}

      {/* Stalk */}
      <path
        d="M100 300 C 96 230, 96 170, 100 90 C 104 170, 104 230, 100 300 Z"
        fill="url(#cornStalk)"
      />

      {/* Leaves */}
      <path
        d="M100 200 C 60 190, 30 170, 18 140 C 50 160, 80 175, 100 195 Z"
        fill="url(#cornHusk)"
      />
      <path
        d="M100 220 C 140 210, 170 188, 184 158 C 154 178, 122 195, 100 215 Z"
        fill="url(#cornHusk)"
      />
      <path
        d="M100 250 C 70 245, 48 232, 36 210 C 60 222, 86 235, 100 245 Z"
        fill="url(#cornHusk)"
        opacity="0.85"
      />

      {/* Cob with kernels */}
      <g transform="translate(100 130)">
        <ellipse cx="0" cy="0" rx="22" ry="58" fill="url(#cornCob)" />
        {Array.from({ length: 7 }).map((_, row) =>
          Array.from({ length: 4 }).map((__, col) => {
            const x = -16 + col * 11 + (row % 2 ? 5 : 0);
            const y = -50 + row * 16;
            return (
              <circle
                key={`${row}-${col}`}
                cx={x}
                cy={y}
                r={3.6}
                fill="#fcd34d"
                stroke="#b45309"
                strokeWidth="0.6"
              />
            );
          }),
        )}
      </g>

      {/* Tassel */}
      <path
        d="M100 90 C 96 76, 92 64, 88 54 M100 90 C 100 74, 100 60, 100 48 M100 90 C 104 76, 108 64, 112 54"
        stroke="#e9d271"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Husk wrap */}
      <path
        d="M82 78 C 78 100, 78 130, 100 138 C 122 130, 122 100, 118 78 C 110 90, 90 90, 82 78 Z"
        fill="url(#cornHusk)"
        opacity="0.92"
      />
    </svg>
  );
}

function WatermelonIllustration({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 200 320" className={styles.svg} aria-hidden="true">
      <defs>
        <radialGradient id="meloGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fca5a5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="meloRind" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#65a30d" />
          <stop offset="55%" stopColor="#3f6212" />
          <stop offset="100%" stopColor="#1a2e05" />
        </linearGradient>
        <linearGradient id="meloFlesh" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="meloVine" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#86c54a" />
          <stop offset="100%" stopColor="#3f6a26" />
        </linearGradient>
      </defs>

      {active && <circle cx="100" cy="200" r="120" fill="url(#meloGlow)" />}

      {/* Vine */}
      <path
        d="M100 60 C 70 90, 60 120, 80 160 C 100 200, 60 230, 100 260"
        stroke="url(#meloVine)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Leaves on vine */}
      <path
        d="M70 100 C 50 90, 32 100, 30 120 C 36 134, 56 138, 70 124 Z"
        fill="#5b8a2e"
      />
      <path
        d="M82 175 C 60 170, 44 184, 50 204 C 64 214, 84 206, 92 188 Z"
        fill="#6c9c39"
      />

      {/* Whole watermelon */}
      <g transform="translate(100 230)">
        <ellipse cx="0" cy="0" rx="78" ry="62" fill="url(#meloRind)" />
        {/* Stripes */}
        {[-50, -28, -8, 14, 36, 56].map((x, i) => (
          <path
            key={i}
            d={`M${x} -55 C ${x - 6} -10, ${x - 6} 10, ${x} 55`}
            stroke="#1a2e05"
            strokeWidth="3.2"
            fill="none"
            opacity="0.55"
          />
        ))}
        {/* Highlight */}
        <ellipse cx="-30" cy="-32" rx="22" ry="10" fill="#a3e635" opacity="0.35" />
      </g>

      {/* Sliced wedge sitting in front */}
      <g transform="translate(140 270) rotate(18)">
        <path
          d="M-30 0 L 30 0 L 0 -42 Z"
          fill="url(#meloFlesh)"
          stroke="#86c54a"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M-30 0 L 30 0" stroke="#fef3c7" strokeWidth="3" />
        <path d="M-30 0 L 30 0" stroke="#86c54a" strokeWidth="2" transform="translate(0 4)" />
        {/* Seeds */}
        {[
          [-12, -10],
          [4, -8],
          [-2, -22],
          [10, -22],
          [-14, -28],
        ].map(([cx, cy], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx="2" ry="3.2" fill="#1a1a1a" />
        ))}
      </g>
    </svg>
  );
}

function BeanIllustration({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 200 320" className={styles.svg} aria-hidden="true">
      <defs>
        <radialGradient id="beanGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#86efac" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#86efac" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beanVine" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7cb342" />
          <stop offset="100%" stopColor="#386a1f" />
        </linearGradient>
        <linearGradient id="beanLeaf" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#86c54a" />
          <stop offset="100%" stopColor="#3f6a26" />
        </linearGradient>
        <linearGradient id="beanPod" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#a7d18a" />
          <stop offset="100%" stopColor="#5d8a3a" />
        </linearGradient>
        <radialGradient id="beanFlower" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#facc15" />
        </radialGradient>
      </defs>

      {active && <circle cx="100" cy="170" r="110" fill="url(#beanGlow)" />}

      {/* Spiraling vine */}
      <path
        d="M100 305 C 80 270, 130 240, 90 210 C 60 185, 130 165, 95 135 C 70 110, 130 95, 100 60"
        stroke="url(#beanVine)"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Leaves */}
      {[
        { x: 70, y: 240, rot: -32 },
        { x: 132, y: 200, rot: 28 },
        { x: 66, y: 165, rot: -18 },
        { x: 132, y: 130, rot: 22 },
        { x: 78, y: 90, rot: -12 },
      ].map((leaf, i) => (
        <g
          key={i}
          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rot})`}
        >
          <path
            d="M0 0 C -22 -6, -34 -22, -28 -38 C -10 -36, 8 -22, 12 -6 C 8 -2, 4 0, 0 0 Z"
            fill="url(#beanLeaf)"
          />
          <path
            d="M0 0 C -10 -10, -18 -22, -24 -34"
            stroke="#2f5217"
            strokeWidth="0.9"
            fill="none"
            opacity="0.7"
          />
        </g>
      ))}

      {/* Bean pods */}
      <g transform="translate(118 232) rotate(28)">
        <path
          d="M0 0 C 4 -22, 8 -42, 6 -58 C -4 -56, -10 -38, -8 -20 C -6 -8, -4 -2, 0 0 Z"
          fill="url(#beanPod)"
          stroke="#3f6a26"
          strokeWidth="0.9"
        />
        {[-10, -22, -34, -46].map((cy, i) => (
          <circle key={i} cx="-1" cy={cy} r="2.2" fill="#2f5217" opacity="0.55" />
        ))}
      </g>
      <g transform="translate(74 130) rotate(-22)">
        <path
          d="M0 0 C 4 -22, 8 -42, 6 -58 C -4 -56, -10 -38, -8 -20 C -6 -8, -4 -2, 0 0 Z"
          fill="url(#beanPod)"
          stroke="#3f6a26"
          strokeWidth="0.9"
        />
        {[-10, -22, -34, -46].map((cy, i) => (
          <circle key={i} cx="-1" cy={cy} r="2.2" fill="#2f5217" opacity="0.55" />
        ))}
      </g>

      {/* Flowers */}
      {[
        { x: 138, y: 168 },
        { x: 60, y: 110 },
      ].map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y})`}>
          {[0, 72, 144, 216, 288].map((rot) => (
            <ellipse
              key={rot}
              cx="0"
              cy="-6"
              rx="3.5"
              ry="6"
              fill="url(#beanFlower)"
              transform={`rotate(${rot})`}
            />
          ))}
          <circle cx="0" cy="0" r="2.4" fill="#b45309" />
        </g>
      ))}
    </svg>
  );
}

const CROPS: CropDef[] = [
  {
    key: 'maiz',
    label: 'Maíz',
    scientific: 'Zea mays',
    tagline: 'El pilar vertical de la milpa',
    accent: '#f59e0b',
    accentSoft: 'rgba(245, 158, 11, 0.15)',
    illustration: (active) => <CornIllustration active={active} />,
  },
  {
    key: 'frijol',
    label: 'Frijol caupí',
    scientific: 'Vigna unguiculata',
    tagline: 'Trepa el maíz y fija nitrógeno',
    accent: '#22c55e',
    accentSoft: 'rgba(34, 197, 94, 0.15)',
    illustration: (active) => <BeanIllustration active={active} />,
  },
  {
    key: 'sandia',
    label: 'Sandía',
    scientific: 'Citrullus lanatus',
    tagline: 'Tapiza el suelo y conserva humedad',
    accent: '#ef4444',
    accentSoft: 'rgba(239, 68, 68, 0.15)',
    illustration: (active) => <WatermelonIllustration active={active} />,
  },
];

interface Crops3DSceneProps {
  className?: string;
}

export default function Crops3DScene({ className = '' }: Crops3DSceneProps) {
  const [active, setActive] = useState<CropKey>('maiz');
  const stageRef = useRef<HTMLDivElement>(null);

  // Auto-rotate the focused crop until the user takes over.
  const userInteractedRef = useRef(false);
  useEffect(() => {
    if (userInteractedRef.current) return;
    const id = window.setInterval(() => {
      if (userInteractedRef.current) return;
      setActive((prev) => {
        const i = CROPS.findIndex((c) => c.key === prev);
        return CROPS[(i + 1) % CROPS.length].key;
      });
    }, 3800);
    return () => window.clearInterval(id);
  }, []);

  // Subtle parallax drift driven by pointer position over the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        stage.style.setProperty('--px', `${(x * 18).toFixed(2)}px`);
        stage.style.setProperty('--py', `${(y * 14).toFixed(2)}px`);
        stage.style.setProperty('--rot', `${(x * 4).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      stage.style.setProperty('--px', '0px');
      stage.style.setProperty('--py', '0px');
      stage.style.setProperty('--rot', '0deg');
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const activeCrop = CROPS.find((c) => c.key === active) ?? CROPS[0];

  const handleSelect = (key: CropKey) => {
    userInteractedRef.current = true;
    setActive(key);
  };

  return (
    <div
      className={`${styles.wrapper} ${className}`}
      style={{ ['--accent' as string]: activeCrop.accent }}
    >
      <div className={styles.gradient} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.stage} ref={stageRef}>
        <div className={styles.scene}>
          {CROPS.map((crop) => {
            const isActive = crop.key === active;
            return (
              <div
                key={crop.key}
                className={`${styles.cropSlot} ${isActive ? styles.cropActive : ''}`}
                data-key={crop.key}
                style={{
                  ['--accent' as string]: crop.accent,
                  ['--accentSoft' as string]: crop.accentSoft,
                }}
              >
                <div className={styles.pedestal} aria-hidden="true">
                  <span className={styles.pedestalRing} />
                  <span className={styles.pedestalDisc} />
                  <span className={styles.pedestalShadow} />
                </div>
                <div className={styles.figure}>{crop.illustration(isActive)}</div>
              </div>
            );
          })}
        </div>

        <div className={styles.info}>
          <span className={styles.infoEyebrow}>{activeCrop.scientific}</span>
          <h3 className={styles.infoTitle}>{activeCrop.label}</h3>
          <p className={styles.infoTagline}>{activeCrop.tagline}</p>
        </div>
      </div>

      <div className={styles.controls} role="tablist" aria-label="Selecciona un cultivo">
        {CROPS.map((crop) => (
          <button
            key={crop.key}
            type="button"
            role="tab"
            aria-selected={crop.key === active}
            className={`${styles.chip} ${crop.key === active ? styles.chipActive : ''}`}
            style={{ ['--accent' as string]: crop.accent }}
            onClick={() => handleSelect(crop.key)}
          >
            <span className={styles.dot} />
            {crop.label}
          </button>
        ))}
      </div>

      <span className={styles.credits}>
        Ilustraciones originales — ASOVICAM
      </span>
    </div>
  );
}
