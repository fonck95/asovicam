import { useEffect, useRef, useState } from 'react';
import { processImage } from '../../utils/imageProcessor';
import styles from './GpuImage.module.css';

interface GpuImageProps {
  src: string;
  alt: string;
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
  const [optimizedSrc, setOptimizedSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(eager);

  useEffect(() => {
    if (eager || !containerRef.current) return;
    const node = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    processImage({ src, maxWidth })
      .then((res) => {
        if (cancelled) {
          if (res.url.startsWith('blob:')) URL.revokeObjectURL(res.url);
          return;
        }
        if (res.url.startsWith('blob:')) createdUrl = res.url;
        setOptimizedSrc(res.url);
      })
      .catch(() => {
        if (!cancelled) setOptimizedSrc(src);
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [inView, src, maxWidth]);

  return (
    <div
      ref={containerRef}
      className={`${styles.frame} ${rounded ? styles.rounded : ''} ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      data-loaded={loaded ? 'true' : 'false'}
    >
      <div className={styles.shimmer} aria-hidden="true" />
      {optimizedSrc && (
        <img
          src={optimizedSrc}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={styles.img}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
