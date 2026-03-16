import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  accentColor?: string;
}

export default function Card({ children, className = '', accentColor }: CardProps) {
  return (
    <div
      className={`${styles.card} ${className}`}
      style={accentColor ? { borderTopColor: accentColor } : undefined}
    >
      {children}
    </div>
  );
}
