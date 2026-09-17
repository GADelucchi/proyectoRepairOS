import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import { Sucursal, User, UsuarioSucursal } from '../models';
import { sucursalesDisponiblesPara } from '../services/sucursalAccess';
import { tallerIdDe } from '../utils/tenant';
import {
  crearSucursalSchema,
  actualizarSucursalSchema,
  otorgarPermisoSchema
} from '../validators/sucursalValidators';

/** Busca una sucursal del taller del usuario o corta con 404. */
async function buscarSucursalDelTaller(req: Request): Promise<Sucursal> {
  const sucursal = await Sucursal.findOne({ where: { id: paramId(req), tallerId: tallerIdDe(req) } });
  if (!sucursal) throw new HttpError(404, 'Sucursal no encontrada');
  return sucursal;
}

/** Sucursales visibles para el usuario autenticado (todas si es admin, o las asignadas). */
export const misSucursales = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'No autenticado');

  const user = await User.findByPk(req.auth.userId);
  if (!user) throw new HttpError(404, 'Usuario no encontrado');

  res.json(await sucursalesDisponiblesPara(user));
});

export const listarSucursales = asyncHandler(async (req: Request, res: Response) => {
  const sucursales = await Sucursal.findAll({
    where: { tallerId: tallerIdDe(req) },
    order: [['nombre', 'ASC']]
  });
  res.json(sucursales);
});

export const crearSucursal = asyncHandler(async (req: Request, res: Response) => {
  const data = crearSucursalSchema.parse(req.body);
  const sucursal = await Sucursal.create({ ...data, tallerId: tallerIdDe(req) });
  res.status(201).json(sucursal);
});

export const actualizarSucursal = asyncHandler(async (req: Request, res: Response) => {
  const sucursal = await buscarSucursalDelTaller(req);
  const data = actualizarSucursalSchema.parse(req.body);
  await sucursal.update(data);
  res.json(sucursal);
});

/** Baja lógica (no se elimina físicamente para preservar el historial de órdenes). */
export const desactivarSucursal = asyncHandler(async (req: Request, res: Response) => {
  const sucursal = await buscarSucursalDelTaller(req);
  await sucursal.update({ activo: false });
  res.status(204).send();
});

export const listarPermisos = asyncHandler(async (req: Request, res: Response) => {
  const sucursal = await Sucursal.findOne({
    where: { id: paramId(req), tallerId: tallerIdDe(req) },
    include: [{ model: User, as: 'usuarios', attributes: ['id', 'nombre', 'apellido', 'email', 'rol'] }]
  });
  if (!sucursal) throw new HttpError(404, 'Sucursal no encontrada');
  res.json((sucursal as any).usuarios ?? []);
});

export const otorgarPermiso = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const sucursal = await buscarSucursalDelTaller(req);
  const { usuarioId } = otorgarPermisoSchema.parse(req.body);

  // El usuario tiene que ser del mismo taller: si no, un admin podría darle
  // acceso a su sucursal a alguien de otro taller solo con saber su id.
  const user = await User.findOne({ where: { id: usuarioId, tallerId } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');

  const [permiso] = await UsuarioSucursal.findOrCreate({
    where: { usuarioId, sucursalId: sucursal.id },
    defaults: { usuarioId, sucursalId: sucursal.id }
  });
  res.status(201).json(permiso);
});

export const revocarPermiso = asyncHandler(async (req: Request, res: Response) => {
  const sucursal = await buscarSucursalDelTaller(req);
  await UsuarioSucursal.destroy({
    where: { sucursalId: sucursal.id, usuarioId: paramId(req, 'usuarioId') }
  });
  res.status(204).send();
});
