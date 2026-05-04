import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  accentColor?: string;
}

export default function Card({ children, className = '', accentColor }: CardProps) {
  const style = accentColor
    ? ({ '--card-accent': accentColor } as CSSProperties)
    : undefined;

  return (
    <div className={`${styles.card} ${className}`} style={style}>
      {children}
    </div>
  );
}
