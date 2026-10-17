import { EstadoOrden } from '../../models/Orden';

/**
 * Máquina de estados de una orden.
 *
 * El frontend tiene una copia en `frontend/src/features/ordenes/estado-orden.ts`
 * para ofrecer solo las transiciones posibles: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  // Desde la recepción se puede ir a cualquier estado. Entregar no: mueve plata
  // y va por su propio flujo, que exige que el equipo esté listo.
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
  // Un rechazo no cierra la orden: el equipo se devuelve sin reparar.
  rechazado: ['no_reparado', 'presupuestado', 'cancelado'],
  en_reparacion: ['listo_para_retirar', 'no_reparado', 'en_espera', 'presupuestado', 'cancelado'],
  // En espera (un repuesto, una respuesta): se retoma donde haga falta.
  en_espera: [
    'en_diagnostico',
    'presupuestado',
    'aprobado',
    'en_reparacion',
    'listo_para_retirar',
    'no_reparado',
    'cancelado'
  ],
  // Si al final no quedó bien, vuelve a reparación.
  listo_para_retirar: ['entregado', 'en_reparacion'],
  no_reparado: ['entregado', 'en_reparacion'],
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
  en_espera: 'En espera',
  listo_para_retirar: 'Reparado - Listo para retirar',
  no_reparado: 'No reparado - Listo para retirar',
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
