import type { EstadoOrden } from '@/shared/types';

/**
 * Máquina de estados de una orden.
 * Copia de `backend/src/modules/ordenes/estado-orden.ts`: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  recibido: [
    'en_diagnostico',
    'presupuestado',
    'aprobado',
    'rechazado',
    'en_reparacion',
    'en_espera',
    'listo_para_retirar',
    'no_reparado',
    'cancelado'
  ],
  en_diagnostico: [
    'presupuestado',
    'en_reparacion',
    'en_espera',
    'listo_para_retirar',
    'no_reparado',
    'cancelado'
  ],
  presupuestado: ['aprobado', 'rechazado', 'en_espera', 'cancelado'],
  aprobado: ['en_reparacion', 'en_espera', 'listo_para_retirar', 'no_reparado', 'cancelado'],
  rechazado: ['no_reparado', 'presupuestado', 'cancelado'],
  en_reparacion: ['listo_para_retirar', 'no_reparado', 'en_espera', 'presupuestado', 'cancelado'],
  en_espera: [
    'en_diagnostico',
    'presupuestado',
    'aprobado',
    'en_reparacion',
    'listo_para_retirar',
    'no_reparado',
    'cancelado'
  ],
  listo_para_retirar: ['entregado', 'en_reparacion'],
  no_reparado: ['entregado', 'en_reparacion'],
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
  en_espera: 'En espera',
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
  en_reparacion: 'badge-blue',
  en_espera: 'badge-orange',
  listo_para_retirar: 'badge-green',
  no_reparado: 'badge-amber',
  // Gris: la orden está cerrada. En verde se confundía con "listo para retirar".
  entregado: 'badge-gris',
  cancelado: 'badge-red'
};

export const ESTADOS_ORDEN = Object.keys(ETIQUETA_ESTADO) as EstadoOrden[];

/** Etiqueta de un estado; uno desconocido (de un historial muy viejo) se muestra tal cual. */
export function etiquetaEstado(estado: string): string {
  return ETIQUETA_ESTADO[estado as EstadoOrden] ?? estado;
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
