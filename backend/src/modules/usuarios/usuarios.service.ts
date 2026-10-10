import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { z } from 'zod';
import { Taller, User } from '../../models';
import { RolUsuario } from '../../models/User';
import { errores } from '../../shared/http/http-error';
import { invalidarCacheUsuario } from '../../shared/middlewares/auth.middleware';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import { notificarAdminsDePlataforma } from '../plataforma/plataforma.service';
import { exigirLugarEnPlan } from '../suscripciones/limites.service';
import { actualizarUsuarioSchema, crearUsuarioSchema } from './usuarios.schemas';

const ATRIBUTOS_PUBLICOS = ['id', 'nombre', 'apellido', 'email', 'rol', 'activo', 'createdAt'] as const;

export function usuarioPublico(u: User) {
  return { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol, activo: u.activo };
}

/** Busca un usuario del taller o corta con 404. */
export async function usuarioDelTaller(tallerId: number, id: number): Promise<User> {
  const usuario = await User.findOne({ where: { id, tallerId } });
  if (!usuario) throw errores.noEncontrado('Usuario');
  return usuario;
}

/**
 * Corta si el cambio deja al taller sin ningún administrador activo, o si el
 * admin se está quitando permisos a sí mismo: en los dos casos nadie podría
 * volver a entrar a administrar el taller.
 */
async function exigirQueQuedeUnAdmin(
  quienCambiaId: number,
  usuario: User,
  cambios: { rol?: RolUsuario; activo?: boolean }
): Promise<void> {
  const pierdeAdmin =
    usuario.rol === 'admin' &&
    usuario.activo &&
    ((cambios.rol !== undefined && cambios.rol !== 'admin') || cambios.activo === false);
  if (!pierdeAdmin) return;

  if (usuario.id === quienCambiaId) {
    throw errores.conflicto('No podés quitarte el rol de administrador ni desactivarte a vos mismo');
  }

  const otrosAdmins = await User.count({
    where: { tallerId: usuario.tallerId, rol: 'admin', activo: true, id: { [Op.ne]: usuario.id } }
  });
  if (otrosAdmins === 0) {
    throw errores.conflicto('El taller tiene que conservar al menos un administrador activo');
  }
}

export function listarUsuarios(tallerId: number): Promise<User[]> {
  return User.findAll({
    where: { tallerId },
    attributes: [...ATRIBUTOS_PUBLICOS],
    order: [['nombre', 'ASC']]
  });
}

/**
 * El email es único en toda la base, no por taller: el login pide solo email y
 * contraseña, así que dos talleres no pueden compartir una dirección. Un
 * duplicado lo frena el índice único (ver error-handler).
 */
export async function crearUsuario(
  tallerId: number,
  creadoPorId: number,
  data: z.infer<typeof crearUsuarioSchema>
): Promise<User> {
  await exigirLugarEnPlan(tallerId, 'usuarios');
  const usuario = await User.create({
    tallerId,
    nombre: data.nombre,
    apellido: data.apellido,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
    rol: data.rol,
    // Lo da de alta un admin del taller, que responde por el email: no se le pide confirmarlo.
    emailVerificadoEn: new Date()
  });

  const taller = await Taller.findByPk(usuario.tallerId, { attributes: ['id', 'nombre'] });
  await notificarAdminsDePlataforma(
    {
      tipo: 'usuario_nuevo',
      titulo: `Nuevo usuario en ${taller?.nombre ?? 'un taller'}`,
      mensaje: `${usuario.nombre} ${usuario.apellido} (${usuario.email}), ${usuario.rol === 'admin' ? 'administrador' : 'técnico'}.`,
      link: `/plataforma?taller=${usuario.tallerId}`
    },
    creadoPorId
  );
  return usuario;
}

export async function actualizarUsuario(
  quienCambiaId: number,
  usuario: User,
  data: z.infer<typeof actualizarUsuarioSchema>
): Promise<User> {
  await exigirQueQuedeUnAdmin(quienCambiaId, usuario, data);
  // Reactivar un usuario dado de baja también ocupa un lugar del plan.
  if (data.activo && !usuario.activo) await exigirLugarEnPlan(usuario.tallerId, 'usuarios', usuario.id);
  await usuario.update(data);

  // Cambiar rol o dar de baja tiene que surtir efecto ya, no cuando expire el token.
  invalidarCacheUsuario(usuario.id);
  return usuario;
}

export async function cambiarPassword(usuario: User, password: string): Promise<void> {
  await usuario.update({ passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
}

/** Baja lógica: preserva el historial de órdenes asociado al técnico. */
export async function desactivarUsuario(quienCambiaId: number, usuario: User): Promise<void> {
  await exigirQueQuedeUnAdmin(quienCambiaId, usuario, { activo: false });
  await usuario.update({ activo: false });
  invalidarCacheUsuario(usuario.id);
}
