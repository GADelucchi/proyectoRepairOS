/**
 * Códigos que el frontend usa para reaccionar a un error sin tener que
 * interpretar el texto del mensaje (que puede cambiar o traducirse).
 */
export type CodigoError =
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'SUCURSAL_REQUERIDA'
  | 'REQUIERE_AUTORIZACION'
  | 'SUSCRIPCION_VENCIDA'
  | 'EMAIL_NO_VERIFICADO'
  | 'LIMITE_DEL_PLAN'
  | 'PLAN_EXCEDIDO';

/**
 * Error esperable de negocio: viaja al cliente con su status y su mensaje.
 *
 * `datos` lleva lo que la pantalla necesita para reaccionar, no solo mostrar.
 * Por ejemplo, un rechazo por falta de cuenta corriente viaja con el monto
 * pendiente para que el mostrador pueda pedir autorización a un supervisor.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly datos?: Record<string, unknown> & { codigo?: CodigoError }
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Atajos para los errores más comunes, así cada controlador no repite el status. */
export const errores = {
  solicitudInvalida: (mensaje: string) => new HttpError(400, mensaje),
  noAutenticado: (mensaje = 'No autenticado') => new HttpError(401, mensaje, { codigo: 'NO_AUTENTICADO' }),
  sinPermiso: (mensaje = 'No tenés permisos para esta acción') =>
    new HttpError(403, mensaje, { codigo: 'SIN_PERMISO' }),
  noEncontrado: (recurso: string) => new HttpError(404, `${recurso} no encontrado`),
  conflicto: (mensaje: string) => new HttpError(409, mensaje),
  sucursalRequerida: () =>
    new HttpError(409, 'Debés seleccionar una sucursal antes de continuar', { codigo: 'SUCURSAL_REQUERIDA' }),
  /** 402: el taller no tiene una suscripción vigente. Bloquea a todos sus usuarios. */
  suscripcionVencida: (mensaje: string, datos: Record<string, unknown> = {}) =>
    new HttpError(402, mensaje, { ...datos, codigo: 'SUSCRIPCION_VENCIDA' }),
  emailNoVerificado: (email: string) =>
    new HttpError(403, 'Todavía no confirmaste tu email. Revisá tu casilla (y la carpeta de spam).', {
      codigo: 'EMAIL_NO_VERIFICADO',
      email
    })
};
