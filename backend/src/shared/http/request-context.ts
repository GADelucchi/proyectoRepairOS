import { Request } from 'express';
import { errores } from './http-error';
import type { JwtPayload } from '../security/jwt';

/**
 * Lectores tipados de lo que `authenticate` dejó en el request.
 *
 * Cada uno corta con el error que corresponde si el dato falta, así los
 * controladores no repiten `req.auth!` ni chequeos de nulos.
 */

/** Usuario autenticado. El rol y el taller ya vienen releídos de la base. */
export function usuarioDe(req: Request): JwtPayload {
  if (!req.auth) throw errores.noAutenticado();
  return req.auth;
}

/**
 * Taller del usuario autenticado: el filtro que separa a un taller de otro.
 * Sale del estado que `authenticate` trae de la base, no del token.
 */
export function tallerIdDe(req: Request): number {
  return usuarioDe(req).tallerId;
}

/** Sucursal elegida después del login. Sin ella, la operación no tiene contexto. */
export function sucursalIdDe(req: Request): number {
  const sucursalId = usuarioDe(req).sucursalId;
  if (!sucursalId) throw errores.sucursalRequerida();
  return sucursalId;
}

export function esAdmin(req: Request): boolean {
  return req.auth?.rol === 'admin';
}

/**
 * Lee un parámetro de ruta numérico y valida que sea un entero positivo.
 *
 * Express 5 tipa `req.params[x]` como `string | string[]`; acá se normaliza y
 * un `/ordenes/abc` se corta con 400 antes de llegar a la base.
 */
export function paramId(req: Request, nombre = 'id'): number {
  const crudo = req.params[nombre];
  const valor = Array.isArray(crudo) ? crudo[0] : crudo;
  const numero = Number(valor);

  if (!valor || !/^\d+$/.test(valor) || !Number.isSafeInteger(numero) || numero <= 0) {
    throw errores.solicitudInvalida(`El identificador "${nombre}" no es válido`);
  }
  return numero;
}
