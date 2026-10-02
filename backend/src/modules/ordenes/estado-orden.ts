import { EstadoOrden } from '../../models/Orden';

/**
 * Máquina de estados de una orden.
 *
 * El frontend tiene una copia en `frontend/src/features/ordenes/estado-orden.ts`
 * para ofrecer solo las transiciones posibles: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  recibido: ['en_diagnostico', 'presupuestado', 'cancelado'],
  en_diagnostico: ['presupuestado', 'en_reparacion', 'cancelado'],
  presupuestado: ['aprobado', 'rechazado', 'cancelado'],
  aprobado: ['en_reparacion', 'cancelado'],
  // Un rechazo no cierra la orden: el equipo se devuelve sin reparar.
  rechazado: ['listo_para_retirar', 'presupuestado', 'cancelado'],
  en_reparacion: ['listo_para_retirar', 'presupuestado', 'cancelado'],
  listo_para_retirar: ['entregado', 'en_reparacion'],
  // Estados finales.
  entregado: [],
  cancelado: []
};

const ETIQUETAS_ESTADO: Record<EstadoOrden, string> = {
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

export function etiquetaEstado(estado: EstadoOrden | string): string {
  return ETIQUETAS_ESTADO[estado as EstadoOrden] ?? estado;
}

export function transicionesDesde(actual: EstadoOrden): readonly EstadoOrden[] {
  return TRANSICIONES_ORDEN[actual] ?? [];
}

export function esTransicionValida(actual: EstadoOrden, siguiente: EstadoOrden): boolean {
  return transicionesDesde(actual).includes(siguiente);
}

export function esEstadoFinal(estado: EstadoOrden): boolean {
  return transicionesDesde(estado).length === 0;
}
