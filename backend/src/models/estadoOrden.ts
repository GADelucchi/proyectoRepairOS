import { EstadoOrden } from './Orden';

/**
 * Transiciones válidas del ciclo de vida de una orden.
 *
 * Antes cualquier estado podía saltar a cualquier otro: se podía pasar de
 * `entregado` a `recibido`, o aprobar un presupuesto que nunca se presupuestó.
 * El README describía esta máquina de estados como una decisión de arquitectura,
 * pero no estaba implementada en ningún lado.
 *
 * Se define acá y la usan el backend (para rechazar) y el frontend (para ofrecer
 * solo lo posible en el desplegable), así no pueden divergir.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, EstadoOrden[]> = {
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

/** Estados a los que se puede pasar desde `actual`. */
export function transicionesDesde(actual: EstadoOrden): EstadoOrden[] {
  return TRANSICIONES_ORDEN[actual] ?? [];
}

export function esTransicionValida(actual: EstadoOrden, siguiente: EstadoOrden): boolean {
  return transicionesDesde(actual).includes(siguiente);
}

export function esEstadoFinal(estado: EstadoOrden): boolean {
  return transicionesDesde(estado).length === 0;
}
