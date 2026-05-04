// Mirrors scripts/optimize-images.mjs output. Keep in sync.
export const IMAGE_WIDTHS = [480, 960, 1600, 2400] as const;

export interface ResponsiveImage {
  /** Base name (without size or extension), e.g. "milpa". Files live at /optimized/{name}-{w}.{ext} */
  name: string;
  /** Original aspect ratio (intrinsic) used for layout reservation. */
  aspectRatio: string;
  /** Largest pre-rendered width available; used as fallback img src and as natural width. */
  fallbackWidth: number;
  /** Optional original (unoptimized) source for download / sharing. */
  original?: string;
}

export const IMAGES = {
  milpa: {
    name: 'milpa',
    aspectRatio: '5632 / 3072',
    fallbackWidth: 1600,
    original: '/milpa.jpg',
  },
  stepsMilpa: {
    name: 'steps-milpa',
    aspectRatio: '5632 / 3072',
    fallbackWidth: 1600,
    original: '/steps-milpa.jpg',
  },
} as const satisfies Record<string, ResponsiveImage>;

export type ImageKey = keyof typeof IMAGES;

export function buildSrcSet(name: string, ext: 'webp' | 'avif'): string {
  return IMAGE_WIDTHS.map((w) => `/optimized/${name}-${w}.${ext} ${w}w`).join(', ');
}
