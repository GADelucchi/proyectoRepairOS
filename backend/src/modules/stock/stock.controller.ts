import { Request, Response } from 'express';
import { esAdmin, paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { revisarVencimientos } from '../ventas/vencimientos.service';
import {
  bajaStockSchema,
  costoReparacionSchema,
  equipoStockSchema,
  listarStockQuery,
  verificarStockQuery
} from './stock.schemas';
import * as stock from './stock.service';

function contexto(req: Request): stock.ContextoStock {
  return {
    tallerId: tallerIdDe(req),
    sucursalId: sucursalIdDe(req),
    usuarioId: usuarioDe(req).userId,
    esAdmin: esAdmin(req)
  };
}

export async function listarStock(req: Request, res: Response): Promise<void> {
  const ctx = contexto(req);
  // Las reservas vencidas vuelven a estar disponibles antes de mostrar el stock.
  await revisarVencimientos(ctx.tallerId);
  res.json(await stock.listarStock(ctx, listarStockQuery.parse(req.query)));
}

/** El equipo, con su venta si la tiene. A un admin le llegan también los costos que se le agregaron. */
async function detalle(ctx: stock.ContextoStock, id: number) {
  const [equipo] = await stock.serializarConVenta([await stock.equipoVisible(ctx, id)], ctx.esAdmin);
  return ctx.esAdmin ? { ...equipo, costosReparacion: await stock.costosDeEquipo(id) } : equipo;
}

export async function obtenerEquipoStock(req: Request, res: Response): Promise<void> {
  res.json(await detalle(contexto(req), paramId(req)));
}

/** Un costo más para el equipo: una reparación, un repuesto (solo admin). */
export async function agregarCosto(req: Request, res: Response): Promise<void> {
  const ctx = contexto(req);
  const datos = costoReparacionSchema.parse(req.body);
  const equipo = await stock.equipoVisible(ctx, paramId(req));
  await stock.agregarCosto(ctx, equipo, datos);
  res.status(201).json(await detalle(ctx, equipo.id));
}

export async function anularCosto(req: Request, res: Response): Promise<void> {
  const ctx = contexto(req);
  const equipo = await stock.equipoVisible(ctx, paramId(req));
  await stock.anularCosto(ctx, equipo, paramId(req, 'costoId'));
  res.json(await detalle(ctx, equipo.id));
}

/** Si el IMEI o el serial ya están en el stock: el formulario avisa antes de guardar. */
export async function verificarRepetido(req: Request, res: Response): Promise<void> {
  const { imei, numeroSerie, excluirId } = verificarStockQuery.parse(req.query);
  const otro = await stock.buscarRepetido(
    tallerIdDe(req),
    { imei: imei?.replace(/\D/g, '') || null, imei2: null, numeroSerie: numeroSerie ?? null },
    { excluirId }
  );
  res.json({
    repetido: otro ? { ...otro.get({ plain: true }), etiqueta: stock.etiquetaNumero(otro.numero) } : null
  });
}

/** Para sugerir el proveedor al cargar un equipo. */
export async function listarProveedores(req: Request, res: Response): Promise<void> {
  res.json(await stock.proveedoresUsados(tallerIdDe(req)));
}

/** Entra al stock de la sucursal elegida. */
export async function crearEquipoStock(req: Request, res: Response): Promise<void> {
  const datos = equipoStockSchema.parse(req.body);
  res.status(201).json(await stock.crearEquipoStock(contexto(req), datos));
}

export async function actualizarEquipoStock(req: Request, res: Response): Promise<void> {
  const ctx = contexto(req);
  const equipo = await stock.equipoVisible(ctx, paramId(req));
  const cuerpo = ctx.esAdmin ? req.body : stock.conCostosDe(equipo, req.body ?? {});
  res.json(await stock.actualizarEquipoStock(ctx, equipo, equipoStockSchema.parse(cuerpo)));
}

export async function darDeBajaEquipoStock(req: Request, res: Response): Promise<void> {
  const ctx = contexto(req);
  const { motivo } = bajaStockSchema.parse(req.body);
  res.json(await stock.darDeBajaEquipoStock(ctx, await stock.equipoVisible(ctx, paramId(req)), motivo));
}
