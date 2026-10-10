import { Request, Response } from 'express';
import { paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { actualizarSucursalSchema, crearSucursalSchema, otorgarPermisoSchema } from './sucursales.schemas';
import * as sucursales from './sucursales.service';

function sucursalDelTaller(req: Request) {
  return sucursales.sucursalDelTaller(tallerIdDe(req), paramId(req));
}

/** Sucursales visibles para el usuario autenticado (todas si es admin, o las asignadas). */
export async function misSucursales(req: Request, res: Response): Promise<void> {
  res.json(await sucursales.sucursalesDeUsuario(usuarioDe(req).userId));
}

export async function listarSucursales(req: Request, res: Response): Promise<void> {
  res.json(await sucursales.listarSucursales(tallerIdDe(req)));
}

export async function crearSucursal(req: Request, res: Response): Promise<void> {
  const data = crearSucursalSchema.parse(req.body);
  res.status(201).json(await sucursales.crearSucursal(tallerIdDe(req), data));
}

export async function actualizarSucursal(req: Request, res: Response): Promise<void> {
  const sucursal = await sucursalDelTaller(req);
  const data = actualizarSucursalSchema.parse(req.body);
  res.json(await sucursales.actualizarSucursal(sucursal, data));
}

/** Baja lógica: no se elimina para preservar el historial de órdenes. */
export async function desactivarSucursal(req: Request, res: Response): Promise<void> {
  await sucursales.desactivarSucursal(await sucursalDelTaller(req));
  res.status(204).send();
}

export async function listarPermisos(req: Request, res: Response): Promise<void> {
  res.json(await sucursales.usuariosConPermiso(tallerIdDe(req), paramId(req)));
}

export async function otorgarPermiso(req: Request, res: Response): Promise<void> {
  const sucursal = await sucursalDelTaller(req);
  const { usuarioId } = otorgarPermisoSchema.parse(req.body);
  res.status(201).json(await sucursales.otorgarPermiso(sucursal, usuarioId));
}

export async function revocarPermiso(req: Request, res: Response): Promise<void> {
  const sucursal = await sucursalDelTaller(req);
  await sucursales.revocarPermiso(sucursal, paramId(req, 'usuarioId'));
  res.status(204).send();
}
