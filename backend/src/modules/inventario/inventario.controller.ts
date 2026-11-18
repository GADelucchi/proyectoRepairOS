import { Request, Response } from 'express';
import { errores } from '../../shared/http/http-error';
import { esAdmin, paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import * as articulos from './articulos.service';
import type { ContextoInventario } from './existencias.service';
import {
  ajusteSchema,
  archivarSchema,
  bajaEntradaSchema,
  categoriaSchema,
  configInventarioSchema,
  cotizacionQuery,
  crearArticuloSchema,
  actualizarArticuloSchema,
  detalleArticuloQuery,
  listarArticulosQuery,
  listarPasesQuery,
  nuevaEntradaSchema,
  nuevoPaseSchema,
  renombrarCategoriaSchema
} from './inventario.schemas';
import * as pases from './pases.service';

export function contextoInventario(req: Request): ContextoInventario {
  return {
    tallerId: tallerIdDe(req),
    sucursalId: sucursalIdDe(req),
    usuarioId: usuarioDe(req).userId,
    esAdmin: esAdmin(req)
  };
}

/** La configuración (nombres de los precios, avisos), las categorías y cuántos artículos tiene cada una. */
export async function obtenerConfig(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const [config, categorias, uso, porRecibir] = await Promise.all([
    articulos.configDelTaller(tallerId),
    articulos.listarCategorias(tallerId),
    articulos.usoDeCategorias(tallerId),
    pases.pasesPorRecibir(contextoInventario(req))
  ]);
  res.json({
    config,
    categorias: categorias.map((c) => ({ ...c.get({ plain: true }), articulos: uso[c.id] ?? 0 })),
    pasesPorRecibir: porRecibir
  });
}

export async function guardarConfig(req: Request, res: Response): Promise<void> {
  res.json(await articulos.guardarConfig(tallerIdDe(req), configInventarioSchema.parse(req.body)));
}

export async function crearCategoria(req: Request, res: Response): Promise<void> {
  const { grupo, nombre } = categoriaSchema.parse(req.body);
  res.status(201).json(await articulos.crearCategoria(tallerIdDe(req), grupo, nombre));
}

export async function renombrarCategoria(req: Request, res: Response): Promise<void> {
  const { nombre } = renombrarCategoriaSchema.parse(req.body);
  res.json(await articulos.renombrarCategoria(tallerIdDe(req), paramId(req), nombre));
}

export async function borrarCategoria(req: Request, res: Response): Promise<void> {
  await articulos.borrarCategoria(tallerIdDe(req), paramId(req));
  res.status(204).send();
}

export async function listarArticulos(req: Request, res: Response): Promise<void> {
  res.json(await articulos.listarArticulos(contextoInventario(req), listarArticulosQuery.parse(req.query)));
}

/** Lo que devuelve el escáner: el artículo con ese código o código de barras. */
export async function buscarPorCodigo(req: Request, res: Response): Promise<void> {
  const codigo = String(req.query.codigo ?? '').trim();
  if (!codigo) throw errores.solicitudInvalida('Indicá el código');
  const articulo = await articulos.buscarPorCodigo(tallerIdDe(req), codigo);
  if (!articulo) throw errores.noEncontrado('Artículo');
  res.json(articulo);
}

export async function obtenerArticulo(req: Request, res: Response): Promise<void> {
  const { sucursal } = detalleArticuloQuery.parse(req.query);
  res.json(await articulos.detalleArticulo(contextoInventario(req), paramId(req), sucursal));
}

export async function crearArticulo(req: Request, res: Response): Promise<void> {
  res
    .status(201)
    .json(await articulos.crearArticulo(contextoInventario(req), crearArticuloSchema.parse(req.body)));
}

export async function actualizarArticulo(req: Request, res: Response): Promise<void> {
  res.json(
    await articulos.actualizarArticulo(
      contextoInventario(req),
      paramId(req),
      actualizarArticuloSchema.parse(req.body)
    )
  );
}

export async function archivarArticulo(req: Request, res: Response): Promise<void> {
  const { activo } = archivarSchema.parse(req.body);
  res.json(await articulos.archivarArticulo(contextoInventario(req), paramId(req), activo));
}

export async function cargarEntrada(req: Request, res: Response): Promise<void> {
  res
    .status(201)
    .json(await articulos.cargarEntrada(contextoInventario(req), nuevaEntradaSchema.parse(req.body)));
}

export async function darDeBajaUnidades(req: Request, res: Response): Promise<void> {
  const { cantidad, motivo } = bajaEntradaSchema.parse(req.body);
  await articulos.darDeBajaUnidades(contextoInventario(req), paramId(req), cantidad, motivo);
  res.status(204).send();
}

/** Ajuste por conteo en la sucursal elegida (solo admin). */
export async function ajustarPorConteo(req: Request, res: Response): Promise<void> {
  res.json(
    await articulos.ajustarPorConteo(contextoInventario(req), paramId(req), ajusteSchema.parse(req.body))
  );
}

export async function listarProveedores(req: Request, res: Response): Promise<void> {
  res.json(await articulos.proveedoresDeInventario(tallerIdDe(req)));
}

/** La última cotización que usó el taller en esa moneda: para sugerirla en los formularios. */
export async function cotizacionSugerida(req: Request, res: Response): Promise<void> {
  const { moneda } = cotizacionQuery.parse(req.query);
  res.json({ cotizacion: await articulos.ultimaCotizacion(tallerIdDe(req), moneda) });
}

export async function listarPases(req: Request, res: Response): Promise<void> {
  const { estado } = listarPasesQuery.parse(req.query);
  const ctx = contextoInventario(req);
  const [lista, destinos] = await Promise.all([pases.listarPases(ctx, estado), pases.sucursalesDestino(ctx)]);
  res.json({ pases: lista, sucursales: destinos });
}

export async function crearPase(req: Request, res: Response): Promise<void> {
  res.status(201).json(await pases.crearPase(contextoInventario(req), nuevoPaseSchema.parse(req.body)));
}

export async function recibirPase(req: Request, res: Response): Promise<void> {
  res.json(await pases.recibirPase(contextoInventario(req), paramId(req)));
}

export async function cancelarPase(req: Request, res: Response): Promise<void> {
  res.json(await pases.cancelarPase(contextoInventario(req), paramId(req)));
}
