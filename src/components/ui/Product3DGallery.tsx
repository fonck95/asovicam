import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import GpuImage from './GpuImage';
import type { ImageKey } from '../../utils/imageManifest';
import styles from './Product3DGallery.module.css';

export interface ProductSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: ImageKey;
  badge?: ReactNode;
  accent?: string;
}

interface Props {
  slides: ProductSlide[];
}

export default function Product3DGallery({ slides }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);

  // Pointer-driven 3D tilt. Per-card RAF, no layout thrash.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = Array.from(stage.querySelectorAll<HTMLElement>(`.${styles.card}`));
    const handlers: Array<() => void> = [];

    cards.forEach((card) => {
      let raf = 0;
      const move = (e: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
          card.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
          card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
          card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
          card.style.setProperty('--lift', '1');
        });
      };
      const leave = () => {
        cancelAnimationFrame(raf);
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--lift', '0');
      };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      handlers.push(() => {
        cancelAnimationFrame(raf);
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerleave', leave);
      });
    });

    return () => handlers.forEach((fn) => fn());
  }, []);

  return (
    <div className={styles.stage} ref={stageRef}>
      {slides.map((slide, idx) => (
        <article
          key={slide.id}
          className={styles.card}
          style={
            {
              '--accent': slide.accent ?? 'var(--color-primary)',
              '--idx': idx,
            } as CSSProperties
          }
        >
          {/* Inner wrapper carries the rotation; outer just provides perspective slot.
              This keeps overflow:hidden on the inner without flattening parent's 3D. */}
          <div className={styles.inner}>
            <div className={styles.media}>
              <GpuImage
                image={slide.image}
                alt={slide.title}
                aspectRatio="4 / 5"
                rounded={false}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
              />
              <div className={styles.glare} aria-hidden="true" />
              <div className={styles.gradient} aria-hidden="true" />
            </div>

            <div className={styles.body}>
              {slide.badge && <span className={styles.badge}>{slide.badge}</span>}
              <h3 className={styles.title}>{slide.title}</h3>
              <p className={styles.subtitle}>{slide.subtitle}</p>
              <p className={styles.description}>{slide.description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
