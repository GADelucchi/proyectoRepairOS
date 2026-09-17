import { Request } from 'express';
import { HttpError } from '../middlewares/errorHandler';

/**
 * Lee un parámetro de ruta numérico.
 *
 * Express 5 tipa `req.params[x]` como `string | string[]`, porque path-to-regexp
 * v8 admite parámetros repetidos. Además de resolver eso, acá se valida que el
 * valor sea un entero positivo: antes el id iba crudo a la consulta y un
 * `/ordenes/abc` terminaba en la base en lugar de cortarse con un 400.
 */
export function paramId(req: Request, nombre = 'id'): number {
  const crudo = req.params[nombre];
  const valor = Array.isArray(crudo) ? crudo[0] : crudo;

  if (valor === undefined || !/^\d+$/.test(valor)) {
    throw new HttpError(400, `El identificador "${nombre}" no es válido`);
  }

  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new HttpError(400, `El identificador "${nombre}" no es válido`);
  }

  return numero;
}
