import { Request, Response } from 'express';
import { esAdmin, paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { revisarVencimientos } from '../ventas/vencimientos.service';
import { bajaStockSchema, equipoStockSchema, listarStockQuery, verificarStockQuery } from './stock.schemas';
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

export async function obtenerEquipoStock(req: Request, res: Response): Promise<void> {
  const ctx = contexto(req);
  const [equipo] = await stock.serializarConVenta([await stock.equipoVisible(ctx, paramId(req))], ctx.esAdmin);
  res.json(equipo);
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
