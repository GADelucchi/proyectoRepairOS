import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';

/** Lo que ya tiene su propia acción dentro de la fila: tocarlo no abre la fila. */
const INTERACTIVOS = 'a, button, input, select, textarea, label, [role="button"]';

/**
 * Props para que toda una fila de tabla abra su detalle con un toque (o con
 * Enter desde el teclado), sin tener que buscar el botón al final. Los botones
 * y links de la fila siguen haciendo lo suyo.
 */
export function filaClickeable(abrir: () => void): HTMLAttributes<HTMLTableRowElement> {
  return {
    className: 'fila-clickeable',
    tabIndex: 0,
    onClick: (e: MouseEvent<HTMLTableRowElement>) => {
      if (!(e.target as HTMLElement).closest(INTERACTIVOS)) abrir();
    },
    onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === 'Enter' && e.target === e.currentTarget) abrir();
    }
  };
}
