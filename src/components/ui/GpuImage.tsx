import { useState, type CSSProperties } from 'react';
import { IMAGES, buildSrcSet, type ImageKey } from '../../utils/imageManifest';
import styles from './GpuImage.module.css';

interface GpuImageProps {
  image: ImageKey;
  alt: string;
  /** Render-size hint in CSS pixels. Used for the `sizes` attribute so the browser picks the right srcset entry. */
  sizes?: string;
  className?: string;
  /** Override the layout aspect ratio (defaults to intrinsic). */
  aspectRatio?: string;
  eager?: boolean;
  rounded?: boolean;
}

export default function GpuImage({
  image,
  alt,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 920px',
  className = '',
  aspectRatio,
  eager = false,
  rounded = true,
}: GpuImageProps) {
  const meta = IMAGES[image];
  const [loaded, setLoaded] = useState(false);

  const style: CSSProperties = {
    aspectRatio: aspectRatio ?? meta.aspectRatio,
  };

  return (
    <div
      className={`${styles.frame} ${rounded ? styles.rounded : ''} ${className}`}
      style={style}
      data-loaded={loaded ? 'true' : 'false'}
    >
      <div className={styles.shimmer} aria-hidden="true" />
      <picture>
        <source type="image/avif" srcSet={buildSrcSet(meta.name, 'avif')} sizes={sizes} />
        <source type="image/webp" srcSet={buildSrcSet(meta.name, 'webp')} sizes={sizes} />
        <img
          src={`/optimized/${meta.name}-${meta.fallbackWidth}.webp`}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
          className={styles.img}
          onLoad={() => setLoaded(true)}
        />
      </picture>
    </div>
  );
}
