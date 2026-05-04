import { useEffect, useRef, useState } from 'react';
import { imageManifest } from '../../data/imageManifest';
import styles from './GpuImage.module.css';

interface GpuImageProps {
  src: string;
  alt: string;
  /** CSS-relative max width hint for `sizes`. */
  maxWidth?: number;
  className?: string;
  aspectRatio?: string;
  eager?: boolean;
  rounded?: boolean;
}

export default function GpuImage({
  src,
  alt,
  maxWidth = 1280,
  className = '',
  aspectRatio,
  eager = false,
  rounded = true,
}: GpuImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(eager);

  const entry = imageManifest[src];
  const computedAspectRatio =
    aspectRatio ?? (entry ? `${entry.naturalWidth} / ${entry.naturalHeight}` : undefined);

  useEffect(() => {
    if (eager || !containerRef.current) return;
    const node = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager]);

  // Pick the smallest variant >= maxWidth for the default `src`, plus a srcset
  // covering all variants so the browser picks the right one for the viewport.
  const variants = entry?.variants ?? [];
  const fallbackSrc =
    variants.find((v) => v.width >= maxWidth)?.src ?? variants.at(-1)?.src ?? src;
  const srcSet = variants.length
    ? variants.map((v) => `${v.src} ${v.width}w`).join(', ')
    : undefined;
  const sizes = `(max-width: 768px) 100vw, ${maxWidth}px`;

  const lqip = entry?.lqip;

  return (
    <div
      ref={containerRef}
      className={`${styles.frame} ${rounded ? styles.rounded : ''} ${className}`}
      style={{
        ...(computedAspectRatio ? { aspectRatio: computedAspectRatio } : null),
        ...(lqip ? { backgroundImage: `url(${lqip})` } : null),
      }}
      data-loaded={loaded ? 'true' : 'false'}
    >
      {!loaded && <div className={styles.shimmer} aria-hidden="true" />}
      {inView && (
        <img
          src={fallbackSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
          className={styles.img}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
