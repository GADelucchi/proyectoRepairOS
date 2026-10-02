import { NextFunction, Request, Response } from 'express';
import { verifyToken, JwtPayload } from '../security/jwt';
import { errores } from '../http/http-error';
import { RolUsuario, User } from '../../models/User';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

interface EstadoUsuario {
  tallerId: number;
  rol: RolUsuario;
  activo: boolean;
  expira: number;
}

/**
 * Caché corto del estado de cada usuario.
 *
 * El JWT es una foto del momento del login: si se desactiva una cuenta o se le
 * baja el rol, el token viejo seguiría siendo válido hasta que expire. Consultar
 * la base en cada request lo arregla, y estos segundos de caché evitan pagar una
 * query por llamada.
 */
const CACHE_MS = 30_000;
const cache = new Map<number, EstadoUsuario>();

/** Fuerza la relectura de un usuario (al cambiarle el rol o darlo de baja). */
export function invalidarCacheUsuario(userId: number): void {
  cache.delete(userId);
}

async function estadoActual(userId: number): Promise<EstadoUsuario | null> {
  const enCache = cache.get(userId);
  if (enCache && enCache.expira > Date.now()) return enCache;

  const user = await User.findByPk(userId, { attributes: ['id', 'tallerId', 'rol', 'activo'] });
  if (!user) {
    cache.delete(userId);
    return null;
  }

  const estado: EstadoUsuario = {
    tallerId: user.tallerId,
    rol: user.rol,
    activo: user.activo,
    expira: Date.now() + CACHE_MS
  };
  cache.set(userId, estado);
  return estado;
}

/** Exige un token válido de un usuario activo y deja su contexto en `req.auth`. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw errores.noAutenticado();

  let payload: JwtPayload;
  try {
    payload = verifyToken(header.slice('Bearer '.length));
  } catch {
    throw errores.noAutenticado('Token inválido o expirado');
  }

  const estado = await estadoActual(payload.userId);
  if (!estado) throw errores.noAutenticado('Token inválido o expirado');
  if (!estado.activo) throw errores.noAutenticado('La cuenta fue desactivada');

  // El rol y el taller vigentes mandan sobre los que venían firmados en el token.
  req.auth = { ...payload, rol: estado.rol, tallerId: estado.tallerId };
  next();
}

export function requireRole(...roles: RolUsuario[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.rol)) throw errores.sinPermiso();
    next();
  };
}

/** Exige que el token incluya una sucursal seleccionada (segundo paso del login). */
export function requireSucursal(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth?.sucursalId) throw errores.sucursalRequerida();
  next();
}
