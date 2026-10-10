import { Request, Response } from 'express';
import { sucursalIdDe, tallerIdDe } from '../../shared/http/request-context';
import * as estadisticas from './estadisticas.service';
import { filtroDeCaja } from './reportes.controller';

/** Tablero de inicio de la sucursal: lo que hay que mirar al abrir el local. */
export async function tablero(req: Request, res: Response): Promise<void> {
  res.json(await estadisticas.tablero(tallerIdDe(req), sucursalIdDe(req)));
}

/** Reportes del período, con el mismo filtro de fechas y sucursales que la caja. */
export async function reportes(req: Request, res: Response): Promise<void> {
  res.json(await estadisticas.reportes(filtroDeCaja(req)));
}
