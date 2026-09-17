import { EstadoOrden } from './types';

/**
 * Mapeo de estado de orden a clase de badge según la identidad visual de RepairOS.
 * Ver src/index.css para la definición de colores (.badge-cyan, .badge-amber, etc).
 */
export const ESTADO_BADGE_CLASS: Record<EstadoOrden, string> = {
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
