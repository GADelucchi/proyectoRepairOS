import { Request, Response } from 'express';
import { paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import {
  actualizarEquipoSchema,
  crearEquipoSchema,
  listarEquiposQuery,
  obtenerEquipoQuery
} from './equipos.schemas';
import * as equipos from './equipos.service';
import { generarNumeroSerieUnico } from './numero-serie';

function equipoDelTaller(req: Request) {
  return equipos.equipoDelTaller(tallerIdDe(req), paramId(req));
}

export async function listarEquipos(req: Request, res: Response): Promise<void> {
  const filtros = listarEquiposQuery.parse(req.query);
  res.json(await equipos.listarEquipos(tallerIdDe(req), filtros));
}

/**
 * Con `?reveal=true` devuelve las credenciales descifradas y deja registrado
 * quién las vio.
 */
export async function obtenerEquipo(req: Request, res: Response): Promise<void> {
  const equipo = await equipoDelTaller(req);
  const { reveal } = obtenerEquipoQuery.parse(req.query);

  if (reveal) {
    const usuario = usuarioDe(req);
    await equipos.registrarAccesoSensible({
      usuarioId: usuario.userId,
      equipoId: equipo.id,
      sucursalId: usuario.sucursalId ?? null,
      ip: req.ip ?? null
    });
  }

  res.json(equipos.serializarEquipo(equipo, reveal));
}

export async function crearEquipo(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const data = crearEquipoSchema.parse(req.body);
  res.status(201).json(await equipos.crearEquipo(tallerId, data));
}

export async function actualizarEquipo(req: Request, res: Response): Promise<void> {
  const equipo = await equipoDelTaller(req);
  const data = actualizarEquipoSchema.parse(req.body);
  res.json(await equipos.actualizarEquipo(equipo, data));
}

export async function eliminarEquipo(req: Request, res: Response): Promise<void> {
  await equipos.eliminarEquipo(await equipoDelTaller(req));
  res.status(204).send();
}

export async function generarNumeroSerie(req: Request, res: Response): Promise<void> {
  res.json({ numeroSerie: await generarNumeroSerieUnico(tallerIdDe(req)) });
}
