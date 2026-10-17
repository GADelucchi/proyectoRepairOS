import type { OpcionChequeo } from '@/shared/types';

/** Un ítem del checklist de recepción mientras se edita. */
export interface ChequeoItem {
  item: string;
  /** Etiqueta elegida entre `opciones`. */
  resultado?: string | null;
  opciones: OpcionChequeo[];
  orden?: number;
}

/**
 * Opciones de los ítems que el técnico agrega a mano, fuera del checklist del tipo.
 * Copia de `OPCIONES_CHEQUEO_POR_DEFECTO` del backend: si cambia una, cambia la otra.
 */
export const OPCIONES_POR_DEFECTO: OpcionChequeo[] = [
  { etiqueta: 'Sin chequear' },
  { etiqueta: 'Sí' },
  { etiqueta: 'No' }
];

/**
 * Ítem nuevo con la primera opción ya marcada: la de cada chequeo es su
 * respuesta predeterminada (se ordena en Configuración).
 */
export function chequeoConRespuestaPorDefecto(
  item: string,
  opciones: OpcionChequeo[] | null | undefined,
  orden: number
): ChequeoItem {
  const validas = opciones?.length ? opciones : OPCIONES_POR_DEFECTO;
  return { item, resultado: validas[0].etiqueta, opciones: validas, orden };
}
