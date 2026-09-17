import { useEffect, useState } from 'react';

/**
 * Devuelve el valor recién cuando dejó de cambiar durante `delay` ms.
 * Se usa en los buscadores para no disparar un request por cada tecla.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
