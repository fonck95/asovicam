import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Atrás/adelante del navegador: dejar que restaure la posición previa.
    if (navigationType === 'POP') return;

    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }

    // 'instant' evita que el scroll-behavior:smooth global anime cada
    // cambio de página.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);

  return null;
}
