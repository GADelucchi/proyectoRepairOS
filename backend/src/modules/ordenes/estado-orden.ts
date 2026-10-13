import { EstadoOrden } from '../../models/Orden';

/**
 * Máquina de estados de una orden.
 *
 * El frontend tiene una copia en `frontend/src/features/ordenes/estado-orden.ts`
 * para ofrecer solo las transiciones posibles: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  recibido: ['en_diagnostico', 'presupuestado', 'cancelado'],
  en_diagnostico: ['presupuestado', 'listo_para_retirar', 'no_reparado', 'cancelado'],
  presupuestado: ['aprobado', 'rechazado', 'cancelado'],
  aprobado: ['listo_para_retirar', 'no_reparado', 'cancelado'],
  // Un rechazo no cierra la orden: el equipo se devuelve sin reparar.
  rechazado: ['no_reparado', 'presupuestado', 'cancelado'],
  // Si al final no quedó bien, vuelve a "aprobado" para seguir trabajando.
  listo_para_retirar: ['entregado', 'aprobado'],
  no_reparado: ['entregado', 'aprobado'],
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
  listo_para_retirar: 'Reparado - Listo para retirar',
  no_reparado: 'No reparado - Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

/** Estados que ya no existen pero pueden aparecer en el historial de órdenes viejas. */
const ETIQUETAS_ESTADO_ANTERIORES: Record<string, string> = {
  en_reparacion: 'En reparación'
};

export function etiquetaEstado(estado: EstadoOrden | string): string {
  return ETIQUETAS_ESTADO[estado as EstadoOrden] ?? ETIQUETAS_ESTADO_ANTERIORES[estado] ?? estado;
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
