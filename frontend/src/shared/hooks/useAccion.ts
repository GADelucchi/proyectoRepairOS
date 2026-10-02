import { useCallback, useState } from 'react';
import { getApiErrorMessage } from '@/shared/api/client';

/**
 * Ejecuta una acción contra la API marcando "en curso" mientras dura y
 * convirtiendo cualquier error en un mensaje legible.
 *
 * Devuelve `true` si la acción terminó bien, para encadenar lo que sigue
 * (cerrar un modal, mostrar un aviso) sin repetir try/catch en cada pantalla.
 */
export function useAccion(onError: (mensaje: string) => void) {
  const [enCurso, setEnCurso] = useState(false);

  const ejecutar = useCallback(
    async (accion: () => Promise<unknown>, mensajeError: string): Promise<boolean> => {
      setEnCurso(true);
      try {
        await accion();
        return true;
      } catch (err) {
        onError(getApiErrorMessage(err, mensajeError));
        return false;
      } finally {
        setEnCurso(false);
      }
    },
    [onError]
  );

  return { enCurso, ejecutar };
}
