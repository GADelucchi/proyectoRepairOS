import { Request, Response } from 'express';
import { esAdmin, sucursalIdDe, tallerIdDe } from '../../shared/http/request-context';
import {
  armarFiltroCaja,
  caja as resumenDeCaja,
  FiltroCaja,
  movimientosDeCaja as cobrosDeCaja
} from './caja.service';
import { rangoCajaQuery } from './reportes.schemas';

/** Filtro de fechas y sucursal de la caja y los reportes. Ver todo el taller es solo para un admin. */
export function filtroDeCaja(req: Request): FiltroCaja {
  const query = rangoCajaQuery.parse(req.query);
  const todas = esAdmin(req) && query.todasLasSucursales;
  const sucursalId = todas ? null : sucursalIdDe(req);
  return armarFiltroCaja({ tallerId: tallerIdDe(req), sucursalId, desde: query.desde, hasta: query.hasta });
}

/** Caja del período: qué plata entró, por qué medio y quién la cobró. */
export async function caja(req: Request, res: Response): Promise<void> {
  res.json(await resumenDeCaja(filtroDeCaja(req)));
}

/** Los cobros del período, uno por uno, para cuadrar la caja contra el cajón. */
export async function movimientosDeCaja(req: Request, res: Response): Promise<void> {
  res.json(await cobrosDeCaja(filtroDeCaja(req)));
}
