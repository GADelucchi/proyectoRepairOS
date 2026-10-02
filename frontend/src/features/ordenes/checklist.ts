import type { OpcionChequeo } from '@/shared/types';

/** Un ítem del checklist de recepción mientras se edita. */
export interface ChequeoItem {
  item: string;
  /** Etiqueta elegida entre `opciones`. */
  resultado?: string | null;
  opciones: OpcionChequeo[];
  orden?: number;
}

/** Opciones de los ítems que el técnico agrega a mano, fuera del checklist del tipo. */
export const OPCIONES_POR_DEFECTO: OpcionChequeo[] = [
  { etiqueta: 'Sí' },
  { etiqueta: 'No' },
  { etiqueta: 'Sin revisar' }
];
