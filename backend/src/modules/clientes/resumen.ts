/** Una orden del cliente, con lo necesario para saber cómo terminó. */
export interface FilaOrdenCliente {
  estado: string;
  /** Respuesta del cliente al presupuesto (MySQL la devuelve como 0/1). */
  presupuestoAprobado: boolean | number | null;
  /** El último "listo para retirar" del historial: 'listo_para_retirar', 'no_reparado' o null. */
  resultado: string | null;
}

export interface ConteoOrdenesCliente {
  total: number;
  enCurso: number;
  reparadas: number;
  noReparadas: number;
  entregadas: number;
  canceladas: number;
}

/** Estados en los que la orden ya terminó el trabajo: su resultado es definitivo. */
const TERMINADAS = new Set(['listo_para_retirar', 'no_reparado', 'entregado']);

/**
 * Cuenta las órdenes de un cliente por cómo terminaron.
 *
 * Reparada o no sale del último paso a "listo para retirar" del historial, solo
 * si la orden ya terminó (una que volvió a "aprobado" todavía no tiene resultado).
 * Antes de existir "No reparado", un presupuesto rechazado también pasaba a
 * "Listo para retirar": esas cuentan como no reparadas.
 */
export function contarOrdenes(filas: FilaOrdenCliente[]): ConteoOrdenesCliente {
  const conteo: ConteoOrdenesCliente = {
    total: filas.length,
    enCurso: 0,
    reparadas: 0,
    noReparadas: 0,
    entregadas: 0,
    canceladas: 0
  };
  for (const { estado, presupuestoAprobado, resultado } of filas) {
    if (estado === 'entregado') conteo.entregadas++;
    else if (estado === 'cancelado') conteo.canceladas++;
    else conteo.enCurso++;

    if (!TERMINADAS.has(estado)) continue;
    const rechazado = presupuestoAprobado === false || presupuestoAprobado === 0;
    if (resultado === 'no_reparado' || (resultado === 'listo_para_retirar' && rechazado)) {
      conteo.noReparadas++;
    } else if (resultado === 'listo_para_retirar') {
      conteo.reparadas++;
    }
  }
  return conteo;
}
