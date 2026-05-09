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

// =====================================================
// SVG illustrations of the milpa crops.
// Designed as layered "3D-look" illustrations with rich
// gradients, soft shadows, highlights and detail layers
// (veins, stripes, kernels) so they read as professional
// botanical art rather than flat icons.
// =====================================================

function CornIllustration({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 200 320" className={styles.svg} aria-hidden="true">
      <defs>
        <linearGradient id="cornStalk" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7fb24f" />
          <stop offset="55%" stopColor="#5e8a36" />
          <stop offset="100%" stopColor="#385219" />
        </linearGradient>
        <linearGradient id="cornStalkHighlight" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="cornCob" cx="0.4" cy="0.45" r="0.7">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#facc15" />
          <stop offset="80%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
        <linearGradient id="cornHusk" x1="0" x2="0.4" y1="0" y2="1">
          <stop offset="0%" stopColor="#bce386" />
          <stop offset="50%" stopColor="#7fa849" />
          <stop offset="100%" stopColor="#3f6a26" />
        </linearGradient>
        <linearGradient id="cornHuskDark" x1="0" x2="0.4" y1="0" y2="1">
          <stop offset="0%" stopColor="#7fa849" />
          <stop offset="100%" stopColor="#2f4f17" />
        </linearGradient>
        <radialGradient id="cornGlow" cx="0.5" cy="0.45" r="0.65">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cornKernelGlow" cx="0.35" cy="0.35" r="0.55">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="60%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <filter id="cornShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {active && <circle cx="100" cy="160" r="120" fill="url(#cornGlow)" />}

      {/* Soft ground shadow */}
      <ellipse cx="100" cy="296" rx="58" ry="6" fill="#000" opacity="0.35" filter="url(#cornShadow)" />

      {/* Stalk with internal segment lines */}
      <g>
        <path
          d="M100 300 C 95 230, 95 170, 100 90 C 105 170, 105 230, 100 300 Z"
          fill="url(#cornStalk)"
        />
        <path
          d="M99 290 L 99 100"
          stroke="url(#cornStalkHighlight)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.7"
        />
        {[280, 250, 220, 190, 160, 130].map((y, i) => (
          <ellipse
            key={i}
            cx="100"
            cy={y}
            rx="6.5"
            ry="2"
            fill="#2f4f17"
            opacity="0.55"
          />
        ))}
      </g>

      {/* Back leaves (darker, behind the cob) */}
      <path
        d="M100 215 C 60 205, 26 175, 12 138 C 50 158, 84 178, 100 210 Z"
        fill="url(#cornHuskDark)"
        opacity="0.85"
      />
      <path
        d="M100 240 C 145 230, 178 200, 192 162 C 156 184, 122 204, 100 234 Z"
        fill="url(#cornHuskDark)"
        opacity="0.85"
      />

      {/* Cob with detailed kernels grid */}
      <g transform="translate(100 132)">
        {/* Cob shadow */}
        <ellipse cx="2" cy="3" rx="22" ry="58" fill="#000" opacity="0.35" filter="url(#cornShadow)" />
        {/* Cob body */}
        <ellipse cx="0" cy="0" rx="22" ry="58" fill="url(#cornCob)" />
        {/* Kernel grid: 9 rows × 5 cols staggered */}
        {Array.from({ length: 9 }).map((_, row) =>
          Array.from({ length: 5 }).map((__, col) => {
            const x = -16 + col * 8 + (row % 2 ? 4 : 0);
            const y = -50 + row * 12;
            // Skip kernels near the tips for a tapered look
            const tipDist = Math.abs(y) / 50;
            if (tipDist > 0.92) return null;
            const r = 3.4 + Math.sin(row * col) * 0.4;
            return (
              <g key={`${row}-${col}`}>
                <ellipse
                  cx={x}
                  cy={y}
                  rx={r}
                  ry={r * 1.08}
                  fill="url(#cornKernelGlow)"
                  stroke="#7c2d12"
                  strokeWidth="0.5"
                  opacity="0.95"
                />
                {/* Tiny highlight on each kernel */}
                <ellipse
                  cx={x - 1}
                  cy={y - 1.2}
                  rx="0.9"
                  ry="0.6"
                  fill="#fffbeb"
                  opacity="0.85"
                />
              </g>
            );
          }),
        )}
        {/* Subtle vertical highlight on cob */}
        <ellipse cx="-7" cy="-6" rx="6" ry="42" fill="#fef3c7" opacity="0.18" />
      </g>

      {/* Front leaves (brighter, in front of cob) */}
      <path
        d="M100 195 C 64 188, 36 170, 22 142 C 56 156, 86 175, 100 192 Z"
        fill="url(#cornHusk)"
      />
      <path
        d="M62 162 C 50 148, 42 132, 38 116"
        stroke="#3f6a26"
        strokeWidth="0.7"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M100 220 C 138 212, 168 192, 184 162 C 154 178, 124 196, 100 217 Z"
        fill="url(#cornHusk)"
      />
      <path
        d="M138 190 C 150 176, 160 160, 168 146"
        stroke="#3f6a26"
        strokeWidth="0.7"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M100 252 C 70 246, 50 234, 38 214 C 60 224, 84 236, 100 246 Z"
        fill="url(#cornHusk)"
        opacity="0.92"
      />

      {/* Inner husk wrap at the base of the cob */}
      <path
        d="M82 78 C 78 100, 78 130, 100 138 C 122 130, 122 100, 118 78 C 110 90, 90 90, 82 78 Z"
        fill="url(#cornHusk)"
        opacity="0.95"
      />
      <path
        d="M88 90 C 88 105, 92 120, 100 128 M 112 90 C 112 105, 108 120, 100 128"
        stroke="#3f6a26"
        strokeWidth="0.6"
        fill="none"
        opacity="0.55"
      />

      {/* Tassel — branching male flower */}
      <g stroke="#e9d271" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M100 90 C 96 76, 92 64, 88 54" />
        <path d="M100 90 C 100 74, 100 60, 100 46" />
        <path d="M100 90 C 104 76, 108 64, 112 54" />
        <path d="M100 78 C 95 70, 90 60, 88 50" />
        <path d="M100 78 C 105 70, 110 60, 112 50" />
        <path d="M100 70 C 96 60, 92 50, 90 42" />
        <path d="M100 70 C 104 60, 108 50, 110 42" />
      </g>
      {/* Pollen specks */}
      {[
        [88, 50], [92, 56], [100, 46], [108, 50], [104, 58], [96, 62],
        [110, 42], [90, 42], [100, 36],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="0.9" fill="#fef3c7" opacity="0.85" />
      ))}

      {/* Silk strands hanging from cob top */}
      <g stroke="#fde68a" strokeWidth="1.1" fill="none" opacity="0.85" strokeLinecap="round">
        <path d="M93 76 C 88 88, 84 100, 80 116" />
        <path d="M97 76 C 94 88, 92 102, 90 120" />
        <path d="M103 76 C 106 88, 108 102, 110 120" />
        <path d="M107 76 C 112 88, 116 100, 120 116" />
      </g>
    </svg>
  );
}

function WatermelonIllustration({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 200 320" className={styles.svg} aria-hidden="true">
      <defs>
        <radialGradient id="meloGlow" cx="0.5" cy="0.7" r="0.6">
          <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fca5a5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="meloRind" cx="0.35" cy="0.32" r="0.85">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="35%" stopColor="#65a30d" />
          <stop offset="75%" stopColor="#3f6212" />
          <stop offset="100%" stopColor="#0e1f04" />
        </radialGradient>
        <radialGradient id="meloFlesh" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="55%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#9f1239" />
        </radialGradient>
        <linearGradient id="meloVine" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a3d057" />
          <stop offset="100%" stopColor="#3f6a26" />
        </linearGradient>
        <linearGradient id="meloLeaf" x1="0" x2="0.5" y1="0" y2="1">
          <stop offset="0%" stopColor="#86c54a" />
          <stop offset="100%" stopColor="#3f6a26" />
        </linearGradient>
        <linearGradient id="meloRindWhite" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#bbf7d0" />
        </linearGradient>
        <filter id="meloShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {active && <circle cx="100" cy="200" r="130" fill="url(#meloGlow)" />}

      {/* Soft ground shadow under the fruit */}
      <ellipse cx="100" cy="295" rx="74" ry="8" fill="#000" opacity="0.4" filter="url(#meloShadow)" />

      {/* Vine */}
      <path
        d="M100 60 C 70 90, 60 120, 80 160 C 100 200, 60 230, 100 260"
        stroke="url(#meloVine)"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Leaves with veins */}
      <g>
        <path
          d="M70 100 C 50 88, 28 96, 24 118 C 32 134, 56 138, 72 122 Z"
          fill="url(#meloLeaf)"
        />
        <path
          d="M70 100 C 60 110, 48 116, 30 118"
          stroke="#2f4f17"
          strokeWidth="0.7"
          fill="none"
          opacity="0.65"
        />
        <path
          d="M62 105 L 56 116 M 66 110 L 60 124"
          stroke="#2f4f17"
          strokeWidth="0.5"
          fill="none"
          opacity="0.5"
        />
      </g>
      <g>
        <path
          d="M82 175 C 58 168, 42 184, 50 206 C 66 216, 86 206, 94 188 Z"
          fill="url(#meloLeaf)"
        />
        <path
          d="M82 175 C 72 184, 62 196, 52 204"
          stroke="#2f4f17"
          strokeWidth="0.7"
          fill="none"
          opacity="0.65"
        />
      </g>

      {/* Whole watermelon */}
      <g transform="translate(100 230)">
        {/* drop shadow */}
        <ellipse cx="3" cy="4" rx="78" ry="62" fill="#000" opacity="0.35" filter="url(#meloShadow)" />
        {/* main body */}
        <ellipse cx="0" cy="0" rx="78" ry="62" fill="url(#meloRind)" />
        {/* Stripes — multiple wavy bands */}
        {[-58, -38, -18, 4, 26, 48].map((x, i) => (
          <g key={i}>
            <path
              d={`M${x} -55 C ${x - 8 + Math.sin(i) * 4} -10, ${x - 8 + Math.cos(i) * 4} 10, ${x + Math.sin(i) * 3} 55`}
              stroke="#0e1f04"
              strokeWidth="6"
              fill="none"
              opacity="0.6"
              strokeLinecap="round"
            />
            <path
              d={`M${x} -55 C ${x - 8 + Math.sin(i) * 4} -10, ${x - 8 + Math.cos(i) * 4} 10, ${x + Math.sin(i) * 3} 55`}
              stroke="#1a3a09"
              strokeWidth="2"
              fill="none"
              opacity="0.85"
              strokeLinecap="round"
            />
          </g>
        ))}
        {/* Faint pebbly mottle dots */}
        {Array.from({ length: 28 }).map((_, i) => {
          const ang = (i / 28) * Math.PI * 2;
          const r = 30 + (i % 5) * 8;
          const cx = Math.cos(ang) * r;
          const cy = Math.sin(ang) * r * 0.78;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="1.2"
              fill="#a3e635"
              opacity="0.18"
            />
          );
        })}
        {/* Glossy highlight */}
        <ellipse cx="-32" cy="-30" rx="26" ry="11" fill="#bef264" opacity="0.45" />
        <ellipse cx="-32" cy="-30" rx="14" ry="5" fill="#fef9c3" opacity="0.55" />
        {/* Stem nub at top */}
        <path
          d="M-3 -60 C -1 -68, 4 -72, 8 -68 C 6 -64, 2 -62, -3 -60 Z"
          fill="#3f6212"
        />
      </g>

      {/* Sliced wedge sitting in front of the whole melon */}
      <g transform="translate(140 274) rotate(20)">
        <path
          d="M-32 0 L 32 0 L 0 -46 Z"
          fill="url(#meloFlesh)"
          stroke="#86c54a"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* White rind layer */}
        <path
          d="M-32 0 L 32 0 L 26 -3 L -26 -3 Z"
          fill="url(#meloRindWhite)"
          opacity="0.95"
        />
        {/* Dark green outer rind line */}
        <path d="M-32 0 L 32 0" stroke="#1a3a09" strokeWidth="2.5" opacity="0.95" />
        {/* Subtle flesh radial sheen */}
        <ellipse cx="0" cy="-22" rx="14" ry="8" fill="#fecaca" opacity="0.45" />
        {/* Seeds — varied */}
        {[
          [-12, -10],
          [4, -8],
          [-2, -22],
          [10, -22],
          [-14, -28],
          [12, -34],
          [-6, -36],
          [0, -16],
          [6, -18],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <ellipse
              cx={cx}
              cy={cy}
              rx="2"
              ry="3.4"
              fill="#1c1917"
              transform={`rotate(${i * 17} ${cx} ${cy})`}
            />
            <ellipse
              cx={cx - 0.4}
              cy={cy - 1}
              rx="0.5"
              ry="1.1"
              fill="#fef3c7"
              opacity="0.55"
              transform={`rotate(${i * 17} ${cx} ${cy})`}
            />
          </g>
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
          <stop offset="0%" stopColor="#a3d057" />
          <stop offset="100%" stopColor="#3f6a26" />
        </linearGradient>
        <linearGradient id="beanLeaf" x1="0" x2="0.4" y1="0" y2="1">
          <stop offset="0%" stopColor="#a3d057" />
          <stop offset="55%" stopColor="#65a30d" />
          <stop offset="100%" stopColor="#2f4f17" />
        </linearGradient>
        <linearGradient id="beanPod" x1="0" x2="1" y1="0.2" y2="0.8">
          <stop offset="0%" stopColor="#d9f99d" />
          <stop offset="40%" stopColor="#a3e635" />
          <stop offset="80%" stopColor="#65a30d" />
          <stop offset="100%" stopColor="#365314" />
        </linearGradient>
        <radialGradient id="beanFlower" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#ca8a04" />
        </radialGradient>
        <radialGradient id="beanSeed" cx="0.4" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#a16207" />
        </radialGradient>
        <filter id="beanShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {active && <circle cx="100" cy="170" r="115" fill="url(#beanGlow)" />}

      {/* Ground shadow */}
      <ellipse cx="100" cy="298" rx="50" ry="5" fill="#000" opacity="0.3" filter="url(#beanShadow)" />

      {/* Spiraling vine */}
      <path
        d="M100 305 C 80 270, 130 240, 90 210 C 60 185, 130 165, 95 135 C 70 110, 130 95, 100 60"
        stroke="url(#beanVine)"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* vine highlight */}
      <path
        d="M100 305 C 80 270, 130 240, 90 210 C 60 185, 130 165, 95 135 C 70 110, 130 95, 100 60"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Leaves (trifoliate) along the vine, with veining */}
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
          {/* drop shadow */}
          <path
            d="M0 0 C -22 -6, -34 -22, -28 -38 C -10 -36, 8 -22, 12 -6 C 8 -2, 4 0, 0 0 Z"
            fill="#000"
            opacity="0.2"
            transform="translate(2 2)"
            filter="url(#beanShadow)"
          />
          <path
            d="M0 0 C -22 -6, -34 -22, -28 -38 C -10 -36, 8 -22, 12 -6 C 8 -2, 4 0, 0 0 Z"
            fill="url(#beanLeaf)"
          />
          {/* central vein */}
          <path
            d="M0 0 C -10 -10, -18 -22, -24 -34"
            stroke="#2f5217"
            strokeWidth="0.9"
            fill="none"
            opacity="0.75"
          />
          {/* side veins */}
          <path
            d="M-6 -8 L -14 -10 M -10 -16 L -22 -18 M -14 -24 L -26 -28"
            stroke="#2f5217"
            strokeWidth="0.5"
            fill="none"
            opacity="0.6"
          />
          {/* highlight */}
          <path
            d="M-6 -6 C -16 -12, -22 -22, -22 -32"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.7"
            fill="none"
          />
        </g>
      ))}

      {/* Bean pods with bean bumps + cowpea eye */}
      {[
        { tx: 118, ty: 232, rot: 28 },
        { tx: 74, ty: 130, rot: -22 },
      ].map((p, idx) => (
        <g key={idx} transform={`translate(${p.tx} ${p.ty}) rotate(${p.rot})`}>
          {/* shadow */}
          <path
            d="M0 0 C 4 -22, 9 -44, 7 -62 C -4 -60, -11 -40, -8 -20 C -6 -8, -4 -2, 0 0 Z"
            fill="#000"
            opacity="0.2"
            transform="translate(1.5 1.5)"
            filter="url(#beanShadow)"
          />
          {/* pod */}
          <path
            d="M0 0 C 4 -22, 9 -44, 7 -62 C -4 -60, -11 -40, -8 -20 C -6 -8, -4 -2, 0 0 Z"
            fill="url(#beanPod)"
            stroke="#2f5217"
            strokeWidth="0.9"
          />
          {/* highlight band along pod */}
          <path
            d="M-2 -6 C -2 -22, 0 -42, 4 -58"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="0.9"
            fill="none"
          />
          {/* bean bumps showing through pod (5 beans) */}
          {[-8, -20, -32, -44, -55].map((cy, i) => (
            <g key={i}>
              <ellipse
                cx="-1"
                cy={cy}
                rx="3.2"
                ry="4"
                fill="url(#beanSeed)"
                opacity="0.85"
              />
              {/* tiny eye on each bean */}
              <ellipse cx="-1" cy={cy} rx="0.9" ry="1.4" fill="#1c1208" opacity="0.6" />
            </g>
          ))}
          {/* tip */}
          <circle cx="6" cy="-62" r="1.4" fill="#365314" />
        </g>
      ))}

      {/* Flowers — yellow papilionaceous shape */}
      {[
        { x: 138, y: 168 },
        { x: 60, y: 110 },
      ].map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y})`}>
          {/* back petals */}
          {[0, 72, 144, 216, 288].map((rot) => (
            <ellipse
              key={rot}
              cx="0"
              cy="-7"
              rx="3.6"
              ry="6.5"
              fill="url(#beanFlower)"
              transform={`rotate(${rot})`}
            />
          ))}
          {/* front banner petal */}
          <ellipse cx="0" cy="-6" rx="4.5" ry="5" fill="#fef9c3" opacity="0.95" />
          {/* center */}
          <circle cx="0" cy="0" r="2.4" fill="#a16207" />
          <circle cx="-0.6" cy="-0.6" r="0.8" fill="#fef3c7" opacity="0.85" />
        </g>
      ))}

      {/* Tendrils curling on vine */}
      <path
        d="M120 220 C 124 218, 128 222, 126 226 C 124 228, 120 224, 124 220"
        stroke="#65a30d"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M88 158 C 84 156, 80 158, 82 162 C 84 166, 88 160, 86 156"
        stroke="#65a30d"
        strokeWidth="1.2"
        fill="none"
      />
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
