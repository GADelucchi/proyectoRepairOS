import type { EstadoOrden } from '@/shared/types';

/**
 * Máquina de estados de una orden.
 * Copia de `backend/src/modules/ordenes/estado-orden.ts`: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  recibido: ['en_diagnostico', 'presupuestado', 'cancelado'],
  en_diagnostico: ['presupuestado', 'listo_para_retirar', 'no_reparado', 'cancelado'],
  presupuestado: ['aprobado', 'rechazado', 'cancelado'],
  aprobado: ['listo_para_retirar', 'no_reparado', 'cancelado'],
  rechazado: ['no_reparado', 'presupuestado', 'cancelado'],
  listo_para_retirar: ['entregado', 'aprobado'],
  no_reparado: ['entregado', 'aprobado'],
  entregado: [],
  cancelado: []
};

export const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  recibido: 'Recibido',
  en_diagnostico: 'En diagnóstico',
  presupuestado: 'Presupuestado',
  aprobado: 'Aprobado por el cliente',
  rechazado: 'Rechazado por el cliente',
  listo_para_retirar: 'Reparado - Listo para retirar',
  no_reparado: 'No reparado - Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

/** Clase de badge de cada estado según la identidad visual (ver `index.css`). */
export const CLASE_BADGE_ESTADO: Record<EstadoOrden, string> = {
  recibido: 'badge-cyan',
  en_diagnostico: 'badge-amber',
  presupuestado: 'badge-violet',
  aprobado: 'badge-violet-light',
  rechazado: 'badge-pink',
  listo_para_retirar: 'badge-green',
  no_reparado: 'badge-amber',
  // Gris: la orden está cerrada. En verde se confundía con "listo para retirar".
  entregado: 'badge-gris',
  cancelado: 'badge-red'
};

export const ESTADOS_ORDEN = Object.keys(ETIQUETA_ESTADO) as EstadoOrden[];

/** Estados que ya no existen pero pueden aparecer en el historial de órdenes viejas. */
const ETIQUETA_ESTADO_ANTERIOR: Record<string, string> = {
  en_reparacion: 'En reparación'
};

/** Etiqueta de un estado, incluidos los que quedaron en el historial de órdenes viejas. */
export function etiquetaEstado(estado: string): string {
  return ETIQUETA_ESTADO[estado as EstadoOrden] ?? ETIQUETA_ESTADO_ANTERIOR[estado] ?? estado;
}

/** El equipo ya se puede retirar, reparado o no. */
export function estaListoParaRetirar(estado: EstadoOrden): boolean {
  return estado === 'listo_para_retirar' || estado === 'no_reparado';
}

export function transicionesDesde(actual: EstadoOrden): readonly EstadoOrden[] {
  return TRANSICIONES_ORDEN[actual] ?? [];
}

export function esEstadoFinal(estado: EstadoOrden): boolean {
  return transicionesDesde(estado).length === 0;
}
