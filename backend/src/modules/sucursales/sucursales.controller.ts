import { Request, Response } from 'express';
import { Sucursal, User, UsuarioSucursal } from '../../models';
import { errores } from '../../shared/http/http-error';
import { paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { exigirLugarEnPlan } from '../suscripciones/limites.service';
import { sucursalesDisponiblesPara } from './sucursal-access.service';
import { actualizarSucursalSchema, crearSucursalSchema, otorgarPermisoSchema } from './sucursales.schemas';

/** Busca una sucursal del taller del usuario o corta con 404. */
async function buscarSucursalDelTaller(req: Request): Promise<Sucursal> {
  const sucursal = await Sucursal.findOne({ where: { id: paramId(req), tallerId: tallerIdDe(req) } });
  if (!sucursal) throw errores.noEncontrado('Sucursal');
  return sucursal;
}

/** Sucursales visibles para el usuario autenticado (todas si es admin, o las asignadas). */
export async function misSucursales(req: Request, res: Response): Promise<void> {
  const user = await User.findByPk(usuarioDe(req).userId);
  if (!user) throw errores.noEncontrado('Usuario');
  res.json(await sucursalesDisponiblesPara(user));
}

export async function listarSucursales(req: Request, res: Response): Promise<void> {
  res.json(await Sucursal.findAll({ where: { tallerId: tallerIdDe(req) }, order: [['nombre', 'ASC']] }));
}

export async function crearSucursal(req: Request, res: Response): Promise<void> {
  const data = crearSucursalSchema.parse(req.body);
  await exigirLugarEnPlan(tallerIdDe(req), 'sucursales');
  res.status(201).json(await Sucursal.create({ ...data, tallerId: tallerIdDe(req) }));
}

export async function actualizarSucursal(req: Request, res: Response): Promise<void> {
  const sucursal = await buscarSucursalDelTaller(req);
  const data = actualizarSucursalSchema.parse(req.body);
  // Reactivar una sucursal dada de baja también ocupa un lugar del plan.
  if (data.activo && !sucursal.activo) await exigirLugarEnPlan(sucursal.tallerId, 'sucursales', sucursal.id);
  await sucursal.update(data);
  res.json(sucursal);
}

/** Baja lógica: no se elimina para preservar el historial de órdenes. */
export async function desactivarSucursal(req: Request, res: Response): Promise<void> {
  const sucursal = await buscarSucursalDelTaller(req);
  await sucursal.update({ activo: false });
  res.status(204).send();
}

export async function listarPermisos(req: Request, res: Response): Promise<void> {
  const sucursal = await Sucursal.findOne({
    where: { id: paramId(req), tallerId: tallerIdDe(req) },
    include: [{ model: User, as: 'usuarios', attributes: ['id', 'nombre', 'apellido', 'email', 'rol'] }]
  });
  if (!sucursal) throw errores.noEncontrado('Sucursal');
  res.json(sucursal.usuarios ?? []);
}

export async function otorgarPermiso(req: Request, res: Response): Promise<void> {
  const sucursal = await buscarSucursalDelTaller(req);
  const { usuarioId } = otorgarPermisoSchema.parse(req.body);

  // El usuario tiene que ser del mismo taller: si no, un admin podría darle
  // acceso a su sucursal a alguien de otro taller solo con saber su id.
  const usuario = await User.findOne({ where: { id: usuarioId, tallerId: sucursal.tallerId } });
  if (!usuario) throw errores.noEncontrado('Usuario');

  const [permiso] = await UsuarioSucursal.findOrCreate({
    where: { usuarioId, sucursalId: sucursal.id },
    defaults: { usuarioId, sucursalId: sucursal.id }
  });
  res.status(201).json(permiso);
}

export async function revocarPermiso(req: Request, res: Response): Promise<void> {
  const sucursal = await buscarSucursalDelTaller(req);
  await UsuarioSucursal.destroy({ where: { sucursalId: sucursal.id, usuarioId: paramId(req, 'usuarioId') } });
  res.status(204).send();
}
