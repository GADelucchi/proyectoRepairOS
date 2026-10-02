import { DependencyList, useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '@/shared/api/client';

/**
 * Carga datos de la API y expone el estado de la carga.
 *
 * Vuelve a consultar cuando cambia algo de `deps` o cuando se llama a
 * `recargar()`. Si llega la respuesta de una consulta vieja (el usuario cambió
 * el filtro mientras tanto), se descarta para no pisar la más nueva.
 */
export function useConsulta<T>(consultar: () => Promise<T>, deps: DependencyList, mensajeError: string) {
  const [datos, setDatos] = useState<T>();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);

    consultar()
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch((err) => {
        if (vigente) setError(getApiErrorMessage(err, mensajeError));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // `consultar` cambia en cada render; lo que define cuándo repetir son `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { datos, setDatos, cargando, error, setError, recargar };
}
