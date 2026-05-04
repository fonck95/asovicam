import { useEffect, useRef, type ReactNode } from 'react';
import GpuImage from './GpuImage';
import styles from './Product3DGallery.module.css';

export interface ProductSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  badge?: ReactNode;
  accent?: string;
}

interface Props {
  slides: ProductSlide[];
}

export default function Product3DGallery({ slides }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);

  // Mouse-driven 3D tilt — pure transforms, no layout thrash.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = Array.from(stage.querySelectorAll<HTMLElement>(`.${styles.card}`));
    let raf = 0;

    const onMove = (card: HTMLElement, e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
      });
    };
    const onLeave = (card: HTMLElement) => {
      cancelAnimationFrame(raf);
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    };

    const handlers: Array<() => void> = [];
    cards.forEach((card) => {
      const move = (e: PointerEvent) => onMove(card, e);
      const leave = () => onLeave(card);
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      handlers.push(() => {
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerleave', leave);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      handlers.forEach((fn) => fn());
    };
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
            } as React.CSSProperties
          }
        >
          <div className={styles.media}>
            <GpuImage
              src={slide.image}
              alt={slide.title}
              maxWidth={920}
              aspectRatio="4 / 5"
              rounded={false}
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
        </article>
      ))}
    </div>
  );
}
