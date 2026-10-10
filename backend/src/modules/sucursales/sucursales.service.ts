import { z } from 'zod';
import { Sucursal, User, UsuarioSucursal } from '../../models';
import { errores } from '../../shared/http/http-error';
import { exigirLugarEnPlan } from '../suscripciones/limites.service';
import { sucursalesDisponiblesPara } from './sucursal-access.service';
import { actualizarSucursalSchema, crearSucursalSchema } from './sucursales.schemas';

/** Busca una sucursal del taller o corta con 404. */
export async function sucursalDelTaller(tallerId: number, id: number): Promise<Sucursal> {
  const sucursal = await Sucursal.findOne({ where: { id, tallerId } });
  if (!sucursal) throw errores.noEncontrado('Sucursal');
  return sucursal;
}

/** Sucursales visibles para el usuario (todas si es admin, o las asignadas). */
export async function sucursalesDeUsuario(usuarioId: number): Promise<Sucursal[]> {
  const user = await User.findByPk(usuarioId);
  if (!user) throw errores.noEncontrado('Usuario');
  return sucursalesDisponiblesPara(user);
}

export function listarSucursales(tallerId: number): Promise<Sucursal[]> {
  return Sucursal.findAll({ where: { tallerId }, order: [['nombre', 'ASC']] });
}

export async function crearSucursal(
  tallerId: number,
  data: z.infer<typeof crearSucursalSchema>
): Promise<Sucursal> {
  await exigirLugarEnPlan(tallerId, 'sucursales');
  return Sucursal.create({ ...data, tallerId });
}

export async function actualizarSucursal(
  sucursal: Sucursal,
  data: z.infer<typeof actualizarSucursalSchema>
): Promise<Sucursal> {
  // Reactivar una sucursal dada de baja también ocupa un lugar del plan.
  if (data.activo && !sucursal.activo) await exigirLugarEnPlan(sucursal.tallerId, 'sucursales', sucursal.id);
  return sucursal.update(data);
}

/** Baja lógica: no se elimina para preservar el historial de órdenes. */
export async function desactivarSucursal(sucursal: Sucursal): Promise<void> {
  await sucursal.update({ activo: false });
}

export async function usuariosConPermiso(tallerId: number, id: number): Promise<User[]> {
  const sucursal = await Sucursal.findOne({
    where: { id, tallerId },
    include: [{ model: User, as: 'usuarios', attributes: ['id', 'nombre', 'apellido', 'email', 'rol'] }]
  });
  if (!sucursal) throw errores.noEncontrado('Sucursal');
  return sucursal.usuarios ?? [];
}

export async function otorgarPermiso(sucursal: Sucursal, usuarioId: number): Promise<UsuarioSucursal> {
  // El usuario tiene que ser del mismo taller: si no, un admin podría darle
  // acceso a su sucursal a alguien de otro taller solo con saber su id.
  const usuario = await User.findOne({ where: { id: usuarioId, tallerId: sucursal.tallerId } });
  if (!usuario) throw errores.noEncontrado('Usuario');

  const [permiso] = await UsuarioSucursal.findOrCreate({
    where: { usuarioId, sucursalId: sucursal.id },
    defaults: { usuarioId, sucursalId: sucursal.id }
  });
  return permiso;
}

export async function revocarPermiso(sucursal: Sucursal, usuarioId: number): Promise<void> {
  await UsuarioSucursal.destroy({ where: { sucursalId: sucursal.id, usuarioId } });
}
