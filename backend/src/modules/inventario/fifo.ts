/** Lo que hace falta de una entrada para repartir: cuánto le queda y su orden de antigüedad. */
export interface EntradaDisponible {
  id: number;
  disponible: number;
}

export interface Tomado {
  entradaId: number;
  cantidad: number;
}

/**
 * De qué entradas salen `cantidad` unidades. Las entradas tienen que venir de
 * la más vieja a la más nueva: se toma primero de la más vieja que tenga, así
 * el costo de lo que se usa es el de lo que se compró antes.
 *
 * Con `preferida` (la entrada que eligió el usuario) se toma primero de esa y,
 * si no alcanza, el resto sigue por antigüedad.
 *
 * Devuelve null si entre todas no alcanza.
 */
export function repartirPorAntiguedad(
  entradas: EntradaDisponible[],
  cantidad: number,
  preferida?: number | null
): Tomado[] | null {
  const orden = preferida
    ? [...entradas.filter((e) => e.id === preferida), ...entradas.filter((e) => e.id !== preferida)]
    : entradas;
  const tomados: Tomado[] = [];
  let falta = cantidad;
  for (const entrada of orden) {
    if (falta <= 0) break;
    const tomar = Math.min(entrada.disponible, falta);
    if (tomar <= 0) continue;
    tomados.push({ entradaId: entrada.id, cantidad: tomar });
    falta -= tomar;
  }
  return falta > 0 ? null : tomados;
}
