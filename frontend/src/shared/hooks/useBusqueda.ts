import { DependencyList, useEffect, useState } from 'react';
import { useDebounce } from './useDebounce';

const MINIMO_CARACTERES = 2;

/**
 * Resultados de una búsqueda mientras el usuario escribe.
 *
 * Espera a que deje de tipear y a que haya al menos dos caracteres; con
 * `activa = false` (por ejemplo, ya eligió un resultado) no busca nada.
 * Una búsqueda que falla deja la lista vacía: es una ayuda, no un dato crítico.
 */
export function useBusqueda<T>(
  texto: string,
  buscar: (texto: string) => Promise<T[]>,
  activa = true,
  deps: DependencyList = []
): T[] {
  const consulta = useDebounce(texto.trim());
  const [resultados, setResultados] = useState<T[]>([]);

  useEffect(() => {
    if (!activa || consulta.length < MINIMO_CARACTERES) {
      setResultados([]);
      return;
    }
    let vigente = true;
    buscar(consulta)
      .then((data) => {
        if (vigente) setResultados(data);
      })
      .catch(() => {
        if (vigente) setResultados([]);
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta, activa, ...deps]);

  return resultados;
}
