import { Transaction } from 'sequelize';
import { z } from 'zod';
import { sequelize, ChequeoPersonalizado, Equipo, Sucursal, TipoEquipoPersonalizado } from '../../models';
import { OPCIONES_CHEQUEO_POR_DEFECTO } from '../../models/OrdenChequeo';
import { errores } from '../../shared/http/http-error';
import { guardarChequeosSchema } from './configuracion.schemas';

/**
 * Tipos de equipo y sus checklists.
 *
 * Los tipos pertenecen a la sucursal, no al técnico que los creó: todo el
 * equipo de esa sucursal comparte el mismo catálogo.
 */

const ORDEN_CHEQUEOS = [
  ['orden', 'ASC'],
  ['id', 'ASC']
] as [string, string][];

/**
 * Corta si el tipo de equipo no pertenece a una sucursal del taller.
 *
 * Los tipos cuelgan de la sucursal y no tienen `taller_id` propio, así que se
 * valida a través de ella: sin esto, un equipo podía quedar apuntando al tipo
 * de otro taller con solo conocer su id.
 */
export async function exigirTipoDelTaller(
  tipoId: number,
  tallerId: number,
  transaction?: Transaction
): Promise<TipoEquipoPersonalizado> {
  const tipo = await TipoEquipoPersonalizado.findOne({
    where: { id: tipoId },
    include: [{ model: Sucursal, as: 'sucursal', where: { tallerId }, attributes: [] }],
    transaction
  });
  if (!tipo) throw errores.noEncontrado('Tipo de equipo');
  return tipo;
}

export async function tipoDeSucursal(sucursalId: number, id: number): Promise<TipoEquipoPersonalizado> {
  const tipo = await TipoEquipoPersonalizado.findOne({ where: { id, sucursalId } });
  if (!tipo) throw errores.noEncontrado('Tipo de equipo');
  return tipo;
}

export function listarTiposEquipo(sucursalId: number): Promise<TipoEquipoPersonalizado[]> {
  return TipoEquipoPersonalizado.findAll({
    where: { sucursalId, activo: true },
    order: [['nombre', 'ASC']]
  });
}

/**
 * Si ya existía dado de baja, se reactiva en lugar de chocar con el índice
 * único. `creado` distingue un alta de una reactivación.
 */
export async function crearTipoEquipo(
  sucursalId: number,
  usuarioId: number,
  nombre: string
): Promise<{ tipo: TipoEquipoPersonalizado; creado: boolean }> {
  const existente = await TipoEquipoPersonalizado.findOne({ where: { sucursalId, nombre } });
  if (existente?.activo) {
    throw errores.conflicto('Ya existe un tipo de equipo con ese nombre en esta sucursal');
  }
  if (existente) {
    await existente.update({ activo: true });
    return { tipo: existente, creado: false };
  }

  const tipo = await TipoEquipoPersonalizado.create({ nombre, usuarioId, sucursalId, activo: true });
  return { tipo, creado: true };
}

export async function renombrarTipoEquipo(
  tipo: TipoEquipoPersonalizado,
  nombre: string | undefined
): Promise<TipoEquipoPersonalizado> {
  if (nombre !== undefined) await tipo.update({ nombre });
  return tipo;
}

/** Si algún equipo lo usa se da de baja lógica, para que siga mostrando su nombre. */
export async function eliminarTipoEquipo(tipo: TipoEquipoPersonalizado): Promise<void> {
  const enUso = await Equipo.count({ where: { tipoEquipoPersonalizadoId: tipo.id } });
  if (enUso > 0) await tipo.update({ activo: false });
  else await tipo.destroy();
}

export function listarChequeos(tipo: TipoEquipoPersonalizado): Promise<ChequeoPersonalizado[]> {
  return ChequeoPersonalizado.findAll({
    where: { tipoEquipoPersonalizadoId: tipo.id },
    order: ORDEN_CHEQUEOS
  });
}

/** Reemplaza la lista completa de chequeos de un tipo de equipo. */
export async function guardarChequeos(
  tipo: TipoEquipoPersonalizado,
  chequeos: z.infer<typeof guardarChequeosSchema>['chequeos']
): Promise<ChequeoPersonalizado[]> {
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
  return listarChequeos(tipo);
}
