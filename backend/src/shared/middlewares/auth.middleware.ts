import { NextFunction, Request, Response } from 'express';
import { verifyToken, JwtPayload } from '../security/jwt';
import { errores } from '../http/http-error';
import { RolUsuario, User } from '../../models/User';
import { esAdminDePlataforma } from '../../modules/plataforma/plataforma.service';
import { excesoDelPlan } from '../../modules/suscripciones/limites.service';
import { errorDeBloqueo, tallerBloqueado } from '../../modules/suscripciones/suscripcion.service';
import { HttpError } from '../http/http-error';

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
  adminPlataforma: boolean;
  /** El taller no tiene suscripción vigente. Nunca para quien administra la plataforma. */
  bloqueado: boolean;
  /** El taller tiene más usuarios o sucursales activos de los que permite su plan. */
  excedido: boolean;
  expira: number;
}

/**
 * Lo único que se puede hacer con el plan excedido: ver el perfil, elegir
 * sucursal y ajustar el taller al plan (y leer los avisos).
 */
const RUTAS_CON_PLAN_EXCEDIDO = [
  /^GET \/api\/auth\/me$/,
  /^POST \/api\/auth\/seleccionar-sucursal$/,
  /^GET \/api\/sucursales\/mis-sucursales$/,
  /^(GET|POST) \/api\/plan\//,
  /^(GET|POST) \/api\/notificaciones/
];

/**
 * Caché corto del estado de cada usuario.
 *
 * El JWT es una foto del momento del login: si se desactiva una cuenta o se le
 * baja el rol, el token viejo seguiría siendo válido hasta que expire. Consultar
 * la base en cada request lo arregla, y estos segundos de caché evitan pagar una
 * query por llamada. Lo mismo vale para la suscripción del taller.
 */
const CACHE_MS = 30_000;
const cache = new Map<number, EstadoUsuario>();

/** Cada cuánto se actualiza el último acceso: alcanza con saber el día y la hora. */
const PRECISION_ULTIMO_ACCESO_MS = 5 * 60_000;

/** Fuerza la relectura de un usuario (al cambiarle el rol o darlo de baja). */
export function invalidarCacheUsuario(userId: number): void {
  cache.delete(userId);
}

/** Fuerza la relectura de todos (al cambiar la suscripción de un taller). */
export function invalidarCacheCompleta(): void {
  cache.clear();
}

/** Deja asentado que el usuario usó la app. No frena el request si falla. */
async function registrarAcceso(user: User): Promise<void> {
  const ahora = Date.now();
  if (user.ultimoAccesoAt && ahora - user.ultimoAccesoAt.getTime() < PRECISION_ULTIMO_ACCESO_MS) return;
  await user.update({ ultimoAccesoAt: new Date(ahora) }).catch(() => undefined);
}

async function estadoActual(userId: number): Promise<EstadoUsuario | null> {
  const enCache = cache.get(userId);
  if (enCache && enCache.expira > Date.now()) return enCache;

  const user = await User.findByPk(userId, {
    attributes: ['id', 'tallerId', 'email', 'rol', 'activo', 'ultimoAccesoAt']
  });
  if (!user) {
    cache.delete(userId);
    return null;
  }

  const adminPlataforma = esAdminDePlataforma(user.email);
  const estado: EstadoUsuario = {
    tallerId: user.tallerId,
    rol: user.rol,
    activo: user.activo,
    adminPlataforma,
    bloqueado: !adminPlataforma && (await tallerBloqueado(user.tallerId)),
    excedido: !adminPlataforma && (await excesoDelPlan(user.tallerId)) !== null,
    expira: Date.now() + CACHE_MS
  };
  if (user.activo) await registrarAcceso(user);
  cache.set(userId, estado);
  return estado;
}

/**
 * Exige un token válido de un usuario activo, de un taller con la suscripción
 * vigente, y deja su contexto en `req.auth`.
 */
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
  if (estado.bloqueado) throw await errorDeBloqueo(estado.tallerId);
  if (
    estado.excedido &&
    !RUTAS_CON_PLAN_EXCEDIDO.some((r) => r.test(`${req.method} ${req.originalUrl.split('?')[0]}`))
  ) {
    throw new HttpError(
      409,
      'El taller tiene más usuarios o sucursales activos de los que permite su plan. Un administrador tiene que elegir cuáles quedan activos.',
      { codigo: 'PLAN_EXCEDIDO' }
    );
  }

  // El rol y el taller vigentes mandan sobre los que venían firmados en el token.
  req.auth = {
    ...payload,
    rol: estado.rol,
    tallerId: estado.tallerId,
    adminPlataforma: estado.adminPlataforma
  };
  next();
}

/** Solo para quien administra la plataforma (ver `PLATFORM_ADMIN_EMAILS`). */
export function requirePlataforma(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth?.adminPlataforma) throw errores.sinPermiso();
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
