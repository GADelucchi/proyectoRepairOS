import { EstadoOrden } from '../../models/Orden';

/**
 * Máquina de estados de una orden.
 *
 * El frontend tiene una copia en `frontend/src/features/ordenes/estado-orden.ts`
 * para ofrecer solo las transiciones posibles: si cambia una, cambia la otra.
 */
export const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  // La orden que le armó otro taller al tercerizarle un equipo: espera a que
  // llegue, o el taller la rechaza.
  por_recibir: ['recibido', 'cancelado'],
  // Desde la recepción se puede ir a cualquier estado. Entregar no: mueve plata
  // y va por su propio flujo, que exige que el equipo esté listo.
  recibido: [
    'en_diagnostico',
    'presupuestado',
    'aprobado',
    'rechazado',
    'en_reparacion',
    'externo',
    'en_espera',
    'listo_para_retirar',
    'no_reparado',
    'cancelado'
  ],
  en_diagnostico: [
    'presupuestado',
    'en_reparacion',
    'externo',
    'en_espera',
    'listo_para_retirar',
    'no_reparado',
    'cancelado'
  ],
  presupuestado: ['aprobado', 'rechazado', 'en_espera', 'cancelado'],
  aprobado: ['en_reparacion', 'externo', 'en_espera', 'listo_para_retirar', 'no_reparado', 'cancelado'],
  // Un rechazo no cierra la orden: el equipo se devuelve sin reparar.
  rechazado: ['no_reparado', 'presupuestado', 'cancelado'],
  en_reparacion: ['listo_para_retirar', 'no_reparado', 'externo', 'en_espera', 'presupuestado', 'cancelado'],
  // Vuelve del taller externo: a seguir acá, ya listo o sin arreglo.
  externo: ['en_reparacion', 'presupuestado', 'en_espera', 'listo_para_retirar', 'no_reparado', 'cancelado'],
  // En espera (un repuesto, una respuesta): se retoma donde haga falta.
  en_espera: [
    'en_diagnostico',
    'presupuestado',
    'aprobado',
    'en_reparacion',
    'externo',
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
  por_recibir: 'Por recibir',
  recibido: 'Recibido',
  en_diagnostico: 'En diagnóstico',
  presupuestado: 'Presupuestado',
  aprobado: 'Aprobado por el cliente',
  rechazado: 'Rechazado por el cliente',
  en_reparacion: 'En reparación',
  externo: 'Externo',
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

/**
 * Estados a los que no se llega con un cambio de estado común, ni siquiera
 * forzándolo: cada uno tiene su flujo, que pide datos que el cambio no trae.
 * Entregar registra el cobro; tercerizar, a quién se manda el equipo; y "por
 * recibir" solo lo pone el sistema al tercerizarle un equipo a otro taller.
 */
export const ESTADOS_CON_FLUJO_PROPIO: readonly EstadoOrden[] = ['entregado', 'externo', 'por_recibir'];

/**
 * Lo que ve el cliente: que el equipo esté en un taller externo es cosa del
 * taller. Para él sigue "En reparación". Vale para el seguimiento, el portal,
 * el remito y los avisos.
 */
export function estadoParaCliente<E extends EstadoOrden | string>(estado: E): E | 'en_reparacion' {
  return estado === 'externo' ? 'en_reparacion' : estado;
}

interface RenglonHistorial {
  estadoAnterior?: string | null;
  estadoNuevo: string;
  comentario?: string | null;
}

/**
 * El historial como lo ve el cliente: con `estadoParaCliente` aplicado y sin
 * los renglones que, así traducidos, no cambian nada ("En reparación" a "En
 * reparación" al mandarlo afuera o al volver). Si el renglón trae comentario
 * queda: es un texto que el taller escribió para el cliente.
 */
export function historialParaCliente<H extends RenglonHistorial>(historial: H[]): H[] {
  return historial
    .map((h) => ({
      ...h,
      estadoAnterior: h.estadoAnterior ? estadoParaCliente(h.estadoAnterior) : h.estadoAnterior,
      estadoNuevo: estadoParaCliente(h.estadoNuevo)
    }))
    .filter((h) => h.estadoAnterior !== h.estadoNuevo || Boolean(h.comentario));
}
