import { Request, Response } from 'express';
import { paramId } from '../../shared/http/request-context';
import * as consola from './consola.service';
import { actualizarSuscripcionSchema, listarQuery } from './plataforma.schemas';

/** Números generales de la plataforma y los últimos registros. */
export async function resumen(_req: Request, res: Response): Promise<void> {
  res.json(await consola.resumen());
}

export async function listarPlanes(_req: Request, res: Response): Promise<void> {
  res.json(await consola.listarPlanes());
}

export async function listarTalleres(req: Request, res: Response): Promise<void> {
  const { search } = listarQuery.parse(req.query);
  res.json(await consola.listarTalleres(search));
}

/** Un taller con sus usuarios y sucursales. */
export async function detalleTaller(req: Request, res: Response): Promise<void> {
  res.json(await consola.detalleTaller(paramId(req)));
}

/** Cambia la suscripción de un taller: extender la prueba, activar un plan o cancelar. */
export async function actualizarSuscripcion(req: Request, res: Response): Promise<void> {
  const tallerId = paramId(req);
  const datos = actualizarSuscripcionSchema.parse(req.body);
  res.json(await consola.actualizarSuscripcion(tallerId, datos));
}

/** Usuarios de todos los talleres, los que usaron la app más recientemente primero. */
export async function listarUsuarios(req: Request, res: Response): Promise<void> {
  const { search } = listarQuery.parse(req.query);
  res.json(await consola.listarUsuarios(search));
}
