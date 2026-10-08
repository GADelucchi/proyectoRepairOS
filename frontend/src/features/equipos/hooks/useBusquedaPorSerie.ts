import { useCallback, useRef, useState } from 'react';
import type { Equipo } from '@/shared/types';
import * as equiposApi from '../api';

/**
 * Busca si un número de serie ya está cargado en el taller, al terminar de
 * escribirlo. No repite la búsqueda si la serie no cambió, y un fallo de red no
 * frena la carga: se sigue como si no existiera.
 */
export function useBusquedaPorSerie(onEncontrado: (equipo: Equipo) => void) {
  const [buscando, setBuscando] = useState(false);
  const ultima = useRef('');

  const buscar = useCallback(
    async (numeroSerie: string) => {
      const serie = numeroSerie.trim();
      if (!serie || serie === ultima.current) return;
      ultima.current = serie;
      setBuscando(true);
      try {
        const equipo = await equiposApi.buscarPorSerie(serie);
        if (equipo) onEncontrado(equipo);
      } catch {
        // Sin conexión no se puede saber: se deja seguir cargando el equipo nuevo.
      } finally {
        setBuscando(false);
      }
    },
    [onEncontrado]
  );

  return { buscando, buscar };
}
