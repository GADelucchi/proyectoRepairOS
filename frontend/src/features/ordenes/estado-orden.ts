import type { EstadoOrden } from '@/shared/types';

/**
 * Máquina de estados de una orden.
 * Copia de `backend/src/modules/ordenes/estado-orden.ts`: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  recibido: ['en_diagnostico', 'presupuestado', 'cancelado'],
  en_diagnostico: ['presupuestado', 'en_reparacion', 'cancelado'],
  presupuestado: ['aprobado', 'rechazado', 'cancelado'],
  aprobado: ['en_reparacion', 'cancelado'],
  rechazado: ['listo_para_retirar', 'presupuestado', 'cancelado'],
  en_reparacion: ['listo_para_retirar', 'presupuestado', 'cancelado'],
  listo_para_retirar: ['entregado', 'en_reparacion'],
  entregado: [],
  cancelado: []
};

export const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  recibido: 'Recibido',
  en_diagnostico: 'En diagnóstico',
  presupuestado: 'Presupuestado',
  aprobado: 'Aprobado por el cliente',
  rechazado: 'Rechazado por el cliente',
  en_reparacion: 'En reparación',
  listo_para_retirar: 'Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

/** Clase de badge de cada estado según la identidad visual (ver `index.css`). */
export const CLASE_BADGE_ESTADO: Record<EstadoOrden, string> = {
  recibido: 'badge-cyan',
  en_diagnostico: 'badge-amber',
  en_reparacion: 'badge-amber',
  presupuestado: 'badge-violet',
  aprobado: 'badge-violet-light',
  rechazado: 'badge-pink',
  listo_para_retirar: 'badge-green',
  entregado: 'badge-green',
  cancelado: 'badge-red'
};

export const ESTADOS_ORDEN = Object.keys(ETIQUETA_ESTADO) as EstadoOrden[];

export function transicionesDesde(actual: EstadoOrden): readonly EstadoOrden[] {
  return TRANSICIONES_ORDEN[actual] ?? [];
}

export function esEstadoFinal(estado: EstadoOrden): boolean {
  return transicionesDesde(estado).length === 0;
}
