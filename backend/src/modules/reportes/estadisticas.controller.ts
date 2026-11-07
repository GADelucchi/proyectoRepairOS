import { Request, Response } from 'express';
import { sucursalIdDe, tallerIdDe } from '../../shared/http/request-context';
import * as estadisticas from './estadisticas.service';
import { filtroDeCaja } from './reportes.controller';
import { ordenesDelPeriodoQuery } from './reportes.schemas';

/** Tablero de inicio de la sucursal: lo que hay que mirar al abrir el local. */
export async function tablero(req: Request, res: Response): Promise<void> {
  res.json(await estadisticas.tablero(tallerIdDe(req), sucursalIdDe(req)));
}

/** Reportes del período, con el mismo filtro de fechas y sucursales que la caja. */
export async function reportes(req: Request, res: Response): Promise<void> {
  res.json(await estadisticas.reportes(filtroDeCaja(req)));
}

/** Las órdenes que ingresaron o se entregaron en el período: el detalle de los números del reporte. */
export async function ordenesDelPeriodo(req: Request, res: Response): Promise<void> {
  const { cuales } = ordenesDelPeriodoQuery.parse(req.query);
  res.json(await estadisticas.ordenesDelPeriodo(filtroDeCaja(req), cuales));
}
