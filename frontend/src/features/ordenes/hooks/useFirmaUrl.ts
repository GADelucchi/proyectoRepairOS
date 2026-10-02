import { useEffect, useState } from 'react';
import * as ordenesApi from '../api';

/**
 * URL local (object URL) de la firma de una orden.
 *
 * La firma no es un archivo público: se pide con el token de sesión, que una
 * etiqueta `<img>` no puede mandar. La URL se libera al desmontar o al cambiar
 * de orden, para no dejar blobs colgados en memoria.
 */
export function useFirmaUrl(ordenId: number, firmadaEn?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!firmadaEn) {
      setUrl(null);
      return;
    }
    let cancelado = false;
    let creada: string | null = null;

    ordenesApi
      .obtenerFirma(ordenId)
      .then((blob) => {
        if (cancelado) return;
        creada = URL.createObjectURL(blob);
        setUrl(creada);
      })
      .catch(() => {
        if (!cancelado) setUrl(null);
      });

    return () => {
      cancelado = true;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [ordenId, firmadaEn]);

  return url;
}
