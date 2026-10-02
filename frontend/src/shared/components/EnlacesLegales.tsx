import { URL_PRIVACIDAD, URL_TERMINOS } from '@/shared/constants/legales';

/** Pie con los enlaces legales, para las pantallas públicas. */
export function EnlacesLegales() {
  return (
    <p className="text-center text-muted small mt-3 mb-0">
      <a href={URL_TERMINOS} target="_blank" rel="noopener noreferrer" className="text-muted">
        Términos
      </a>
      {' · '}
      <a href={URL_PRIVACIDAD} target="_blank" rel="noopener noreferrer" className="text-muted">
        Privacidad
      </a>
    </p>
  );
}
