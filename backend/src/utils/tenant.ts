import { Request } from 'express';
import { HttpError } from '../middlewares/errorHandler';

/**
 * Taller del usuario autenticado.
 *
 * Es el filtro que separa a un taller de otro, así que se lee del estado que
 * `authenticate` trae de la base y no del token: un token viejo no puede pedir
 * datos de un taller al que su usuario ya no pertenece.
 */
export function tallerIdDe(req: Request): number {
  const tallerId = req.auth?.tallerId;
  if (!tallerId) throw new HttpError(401, 'No autenticado');
  return tallerId;
}
