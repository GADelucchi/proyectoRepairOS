import { Request, Response } from 'express';
import { Taller } from '../../models';
import { errores } from '../../shared/http/http-error';
import { esAdmin, paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { filtroDeCaja } from '../reportes/reportes.controller';
import { etiquetaVenta } from './calculos';
import { informeVentas } from './informe.service';
import { generarVentaPdf } from './venta-pdf.service';
import {
  cancelarVentaSchema,
  crearVentaSchema,
  extenderReservaSchema,
  listarVentasQuery,
  pagarVentaSchema
} from './ventas.schemas';
import * as ventas from './ventas.service';

function contexto(req: Request): ventas.ContextoVenta {
  return {
    tallerId: tallerIdDe(req),
    sucursalId: sucursalIdDe(req),
    usuarioId: usuarioDe(req).userId,
    esAdmin: esAdmin(req)
  };
}

async function ventaDe(req: Request) {
  return ventas.ventaVisible(contexto(req), paramId(req));
}

export async function listarVentas(req: Request, res: Response): Promise<void> {
  res.json(await ventas.listarVentas(contexto(req), listarVentasQuery.parse(req.query)));
}

export async function obtenerVenta(req: Request, res: Response): Promise<void> {
  res.json(ventas.serializarVenta(await ventaDe(req), esAdmin(req)));
}

export async function crearVenta(req: Request, res: Response): Promise<void> {
  res.status(201).json(await ventas.crearVenta(contexto(req), crearVentaSchema.parse(req.body)));
}

export async function pagarVenta(req: Request, res: Response): Promise<void> {
  res.json(await ventas.pagarVenta(contexto(req), await ventaDe(req), pagarVentaSchema.parse(req.body)));
}

export async function extenderReserva(req: Request, res: Response): Promise<void> {
  const { hasta } = extenderReservaSchema.parse(req.body);
  res.json(await ventas.extenderReserva(contexto(req), await ventaDe(req), hasta));
}

export async function cancelarVenta(req: Request, res: Response): Promise<void> {
  res.json(
    await ventas.cancelarVenta(contexto(req), await ventaDe(req), cancelarVentaSchema.parse(req.body))
  );
}

export async function descargarPdf(req: Request, res: Response): Promise<void> {
  const venta = await ventaDe(req);
  const taller = await Taller.findByPk(venta.tallerId);
  if (!taller) throw errores.noEncontrado('Taller');
  const pdf = await generarVentaPdf(venta, taller);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${etiquetaVenta(venta.numero)}.pdf"`);
  res.send(pdf);
}

/** Costo, bruto y ganancia del período, en US$. Con el mismo filtro de fechas y sucursales que la caja. */
export async function informe(req: Request, res: Response): Promise<void> {
  res.json(await informeVentas(filtroDeCaja(req)));
}
