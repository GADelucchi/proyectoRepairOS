import { NextFunction, Request, Response } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { RolUsuario, User } from '../models/User';

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
 * baja el rol, el token viejo sigue siendo válido hasta que expira. Consultar la
 * base en cada request lo arregla, y estos pocos segundos de caché evitan pagar
 * una query por llamada sin volver a la ventana de ocho horas.
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

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No autenticado' });
    return;
  }

  const token = header.slice('Bearer '.length);

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
    return;
  }

  try {
    const estado = await estadoActual(payload.userId);
    if (!estado) {
      res.status(401).json({ message: 'Token inválido o expirado' });
      return;
    }
    if (!estado.activo) {
      res.status(401).json({ message: 'La cuenta fue desactivada' });
      return;
    }

    // El rol y el taller vigentes mandan sobre los que venían firmados en el token.
    req.auth = { ...payload, rol: estado.rol, tallerId: estado.tallerId };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.rol)) {
      res.status(403).json({ message: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  };
}

/** Exige que el token incluya una sucursal seleccionada (post-login). */
export function requireSucursal(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.sucursalId) {
    res.status(409).json({ message: 'Debes seleccionar una sucursal antes de continuar' });
    return;
  }
  next();
}
