import { Request, Response } from 'express';
import { paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { equipoStockSchema, listarStockQuery } from './stock.schemas';
import * as stock from './stock.service';

function contexto(req: Request): stock.ContextoStock {
  return { tallerId: tallerIdDe(req), sucursalId: sucursalIdDe(req), usuarioId: usuarioDe(req).userId };
}

export async function listarStock(req: Request, res: Response): Promise<void> {
  res.json(await stock.listarStock(contexto(req), listarStockQuery.parse(req.query)));
}

export async function obtenerEquipoStock(req: Request, res: Response): Promise<void> {
  res.json(stock.serializarEquipoStock(await stock.equipoVisible(contexto(req), paramId(req))));
}

/** Entra al stock de la sucursal elegida. */
export async function crearEquipoStock(req: Request, res: Response): Promise<void> {
  const datos = equipoStockSchema.parse(req.body);
  res.status(201).json(await stock.crearEquipoStock(contexto(req), datos));
}

export async function actualizarEquipoStock(req: Request, res: Response): Promise<void> {
  const ctx = contexto(req);
  const equipo = await stock.equipoVisible(ctx, paramId(req));
  res.json(await stock.actualizarEquipoStock(ctx, equipo, equipoStockSchema.parse(req.body)));
}

export async function eliminarEquipoStock(req: Request, res: Response): Promise<void> {
  await stock.eliminarEquipoStock(await stock.equipoVisible(contexto(req), paramId(req)));
  res.status(204).send();
}
