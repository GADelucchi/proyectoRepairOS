import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { sequelize, User, Sucursal, Taller, Suscripcion } from '../../models';
import { errores } from '../../shared/http/http-error';
import { usuarioDe } from '../../shared/http/request-context';
import { signToken } from '../../shared/security/jwt';
import { finDeGracia, suscripcionDeTaller } from '../suscripciones/suscripcion.service';
import {
  puedeAccederASucursal,
  sucursalesDisponiblesPara,
  sucursalPublica
} from '../sucursales/sucursal-access.service';
import { loginSchema, registroSchema, seleccionarSucursalSchema } from './auth.schemas';

/** Costo de bcrypt. 10 es el estándar razonable para un login interactivo. */
export const BCRYPT_ROUNDS = 10;

function usuarioPublico(u: User) {
  return { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol };
}

function tokenDeSesion(u: User, sucursalId?: number): string {
  return signToken({ userId: u.id, tallerId: u.tallerId, rol: u.rol, sucursalId });
}

/**
 * Alta de un taller nuevo: taller, usuario administrador y suscripción en
 * prueba, en una sola transacción (un taller sin usuario sería una cuenta
 * imposible de usar y de limpiar).
 *
 * Devuelve el token ya emitido: el dueño queda adentro sin repetir credenciales.
 * Un email repetido lo resuelve el índice único de la base (ver error-handler).
 */
export async function registrar(req: Request, res: Response): Promise<void> {
  const data = registroSchema.parse(req.body);

  if (await User.count({ where: { email: data.email } })) {
    throw errores.conflicto('Ya existe una cuenta con ese email');
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const usuario = await sequelize.transaction(async (transaction) => {
    const taller = await Taller.create({ nombre: data.nombreTaller }, { transaction });
    const nuevo = await User.create(
      {
        tallerId: taller.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        passwordHash,
        rol: 'admin'
      },
      { transaction }
    );
    await Suscripcion.create(
      { tallerId: taller.id, estado: 'prueba', graciaHasta: finDeGracia() },
      { transaction }
    );
    return nuevo;
  });

  res.status(201).json({
    token: tokenDeSesion(usuario),
    usuario: usuarioPublico(usuario),
    suscripcion: await suscripcionDeTaller(usuario.tallerId)
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ where: { email } });
  // Mismo mensaje para "no existe" y "contraseña incorrecta": no revela qué emails tienen cuenta.
  const passwordOk = user?.activo ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordOk) throw errores.noAutenticado('Credenciales inválidas');

  res.json({ token: tokenDeSesion(user), usuario: usuarioPublico(user) });
}

/** Segundo paso del login: emite un token nuevo con la sucursal elegida. */
export async function seleccionarSucursal(req: Request, res: Response): Promise<void> {
  const { sucursalId } = seleccionarSucursalSchema.parse(req.body);

  const user = await User.findByPk(usuarioDe(req).userId);
  if (!user?.activo) throw errores.noAutenticado('Cuenta no disponible');

  const sucursal = await Sucursal.findOne({
    where: { id: sucursalId, tallerId: user.tallerId, activo: true }
  });
  if (!sucursal) throw errores.noEncontrado('Sucursal');
  if (!(await puedeAccederASucursal(user, sucursalId))) {
    throw errores.sinPermiso('No tenés acceso a esta sucursal');
  }

  res.json({
    token: tokenDeSesion(user, sucursalId),
    sucursal: { id: sucursal.id, nombre: sucursal.nombre }
  });
}

/** Perfil de la sesión: usuario, taller, suscripción y sucursales disponibles. */
export async function me(req: Request, res: Response): Promise<void> {
  const auth = usuarioDe(req);
  const user = await User.findByPk(auth.userId, {
    include: [{ model: Taller, as: 'taller', attributes: ['id', 'nombre'] }]
  });
  if (!user) throw errores.noEncontrado('Usuario');

  const sucursales = await sucursalesDisponiblesPara(user);

  // Si la sucursal del token se desactivó o dejó de estar disponible, se limpia
  // para que la app pida elegir de nuevo.
  const sucursalActualId = sucursales.some((s) => s.id === auth.sucursalId) ? auth.sucursalId : null;

  res.json({
    ...usuarioPublico(user),
    taller: user.taller ? { id: user.taller.id, nombre: user.taller.nombre } : null,
    suscripcion: await suscripcionDeTaller(user.tallerId),
    sucursalActualId,
    sucursales: sucursales.map(sucursalPublica)
  });
}
