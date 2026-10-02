import type { Orden } from '@/shared/types';

/** Lo que recibe cada sección del detalle de una orden. */
export interface SeccionOrdenProps {
  orden: Orden;
  /** false si la orden está cerrada y el usuario no es admin. */
  puedeEditar: boolean;
  /** La sección cambió algo: se muestra el mensaje y se recarga la orden. */
  onActualizada: (mensaje?: string) => void;
  onError: (mensaje: string) => void;
}
