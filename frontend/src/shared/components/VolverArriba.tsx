import { useEffect, useState } from 'react';

/** A partir de cuánto scroll aparece el botón. */
const UMBRAL_PX = 500;

/** Botón flotante para volver al principio de la pantalla en listados largos. */
export function VolverArriba() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const revisar = () => setVisible(window.scrollY > UMBRAL_PX);
    revisar();
    window.addEventListener('scroll', revisar, { passive: true });
    return () => window.removeEventListener('scroll', revisar);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="volver-arriba"
      aria-label="Volver arriba"
      title="Volver arriba"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
