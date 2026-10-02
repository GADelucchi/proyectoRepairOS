import { Request, Response } from 'express';
import { sequelize, ChequeoPersonalizado, Equipo, TipoEquipoPersonalizado } from '../../models';
import { OPCIONES_CHEQUEO_POR_DEFECTO } from '../../models/OrdenChequeo';
import { errores } from '../../shared/http/http-error';
import { paramId, sucursalIdDe, usuarioDe } from '../../shared/http/request-context';
import { actualizarTipoSchema, crearTipoSchema, guardarChequeosSchema } from './configuracion.schemas';

/**
 * Configuración de tipos de equipo y sus checklists.
 *
 * Los tipos pertenecen a la sucursal, no al técnico que los creó: todo el
 * equipo de esa sucursal comparte el mismo catálogo.
 */

const ORDEN_CHEQUEOS = [
  ['orden', 'ASC'],
  ['id', 'ASC']
] as [string, string][];

async function buscarTipoDeSucursal(req: Request, id: number): Promise<TipoEquipoPersonalizado> {
  const tipo = await TipoEquipoPersonalizado.findOne({ where: { id, sucursalId: sucursalIdDe(req) } });
  if (!tipo) throw errores.noEncontrado('Tipo de equipo');
  return tipo;
}

export async function listarTiposEquipo(req: Request, res: Response): Promise<void> {
  const tipos = await TipoEquipoPersonalizado.findAll({
    where: { sucursalId: sucursalIdDe(req), activo: true },
    order: [['nombre', 'ASC']]
  });
  res.json(tipos);
}

/** Si ya existía dado de baja, se reactiva en lugar de chocar con el índice único. */
export async function crearTipoEquipo(req: Request, res: Response): Promise<void> {
  const sucursalId = sucursalIdDe(req);
  const { nombre } = crearTipoSchema.parse(req.body);

  const existente = await TipoEquipoPersonalizado.findOne({ where: { sucursalId, nombre } });
  if (existente?.activo) {
    throw errores.conflicto('Ya existe un tipo de equipo con ese nombre en esta sucursal');
  }
  if (existente) {
    await existente.update({ activo: true });
    res.json(existente);
    return;
  }

  const tipo = await TipoEquipoPersonalizado.create({
    nombre,
    usuarioId: usuarioDe(req).userId,
    sucursalId,
    activo: true
  });
  res.status(201).json(tipo);
}

export async function actualizarTipoEquipo(req: Request, res: Response): Promise<void> {
  const tipo = await buscarTipoDeSucursal(req, paramId(req));
  const { nombre } = actualizarTipoSchema.parse(req.body);
  if (nombre !== undefined) await tipo.update({ nombre });
  res.json(tipo);
}

/** Si algún equipo lo usa se da de baja lógica, para que siga mostrando su nombre. */
export async function eliminarTipoEquipo(req: Request, res: Response): Promise<void> {
  const tipo = await buscarTipoDeSucursal(req, paramId(req));
  const enUso = await Equipo.count({ where: { tipoEquipoPersonalizadoId: tipo.id } });

  if (enUso > 0) await tipo.update({ activo: false });
  else await tipo.destroy();

  res.status(204).send();
}

export async function listarChequeos(req: Request, res: Response): Promise<void> {
  const tipo = await buscarTipoDeSucursal(req, paramId(req, 'tipoId'));
  res.json(
    await ChequeoPersonalizado.findAll({
      where: { tipoEquipoPersonalizadoId: tipo.id },
      order: ORDEN_CHEQUEOS
    })
  );
}

/** Reemplaza la lista completa de chequeos de un tipo de equipo. */
export async function guardarChequeos(req: Request, res: Response): Promise<void> {
  const tipo = await buscarTipoDeSucursal(req, paramId(req, 'tipoId'));
  const { chequeos } = guardarChequeosSchema.parse(req.body);

  await sequelize.transaction(async (transaction) => {
    await ChequeoPersonalizado.destroy({ where: { tipoEquipoPersonalizadoId: tipo.id }, transaction });
    await ChequeoPersonalizado.bulkCreate(
      chequeos.map((c, indice) => ({
        tipoEquipoPersonalizadoId: tipo.id,
        texto: c.texto,
        opciones: c.opciones ?? OPCIONES_CHEQUEO_POR_DEFECTO,
        orden: indice
      })),
      { transaction }
    );
  });

  res.json(
    await ChequeoPersonalizado.findAll({
      where: { tipoEquipoPersonalizadoId: tipo.id },
      order: ORDEN_CHEQUEOS
    })
  );
}
