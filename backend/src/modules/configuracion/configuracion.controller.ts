import { Request, Response } from 'express';
import { paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import {
  actualizarTallerSchema,
  actualizarTipoSchema,
  crearTipoSchema,
  guardarChequeosSchema
} from './configuracion.schemas';
import { actualizarTaller as guardarTaller } from './configuracion.service';
import * as tipos from './tipos-equipo.service';

/** Configuración de tipos de equipo, sus checklists y los datos del taller. */

function tipoDeSucursal(req: Request, id: number) {
  return tipos.tipoDeSucursal(sucursalIdDe(req), id);
}

export async function listarTiposEquipo(req: Request, res: Response): Promise<void> {
  res.json(await tipos.listarTiposEquipo(sucursalIdDe(req)));
}

/** Un alta responde 201; reactivar uno dado de baja, 200. */
export async function crearTipoEquipo(req: Request, res: Response): Promise<void> {
  const sucursalId = sucursalIdDe(req);
  const { nombre } = crearTipoSchema.parse(req.body);
  const { tipo, creado } = await tipos.crearTipoEquipo(sucursalId, usuarioDe(req).userId, nombre);
  res.status(creado ? 201 : 200).json(tipo);
}

export async function actualizarTipoEquipo(req: Request, res: Response): Promise<void> {
  const tipo = await tipoDeSucursal(req, paramId(req));
  const { nombre } = actualizarTipoSchema.parse(req.body);
  res.json(await tipos.renombrarTipoEquipo(tipo, nombre));
}

export async function eliminarTipoEquipo(req: Request, res: Response): Promise<void> {
  await tipos.eliminarTipoEquipo(await tipoDeSucursal(req, paramId(req)));
  res.status(204).send();
}

export async function listarChequeos(req: Request, res: Response): Promise<void> {
  const tipo = await tipoDeSucursal(req, paramId(req, 'tipoId'));
  res.json(await tipos.listarChequeos(tipo));
}

/** Reemplaza la lista completa de chequeos de un tipo de equipo. */
export async function guardarChequeos(req: Request, res: Response): Promise<void> {
  const tipo = await tipoDeSucursal(req, paramId(req, 'tipoId'));
  const { chequeos } = guardarChequeosSchema.parse(req.body);
  res.json(await tipos.guardarChequeos(tipo, chequeos));
}

/** Nombre y país del taller. Las órdenes ya cargadas conservan su moneda. */
export async function actualizarTaller(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  res.json(await guardarTaller(tallerId, actualizarTallerSchema.parse(req.body)));
}
