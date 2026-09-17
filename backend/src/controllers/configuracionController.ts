import { Request, Response } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import { TipoEquipoPersonalizado, ChequeoPersonalizado, Equipo, sequelize } from '../models';
import { z } from 'zod';

const crearTipoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido')
});

const actualizarTipoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').optional()
});

const guardarChequeosSchema = z.object({
  chequeos: z.array(
    z.object({
      texto: z.string().trim().min(1, 'El texto del chequeo es requerido'),
      opciones: z
        .array(
          z.object({
            etiqueta: z.string().trim().min(1, 'Todas las opciones deben tener una etiqueta')
          })
        )
        .min(1, 'Cada chequeo necesita al menos una opción de respuesta')
        .optional()
    })
  )
});

const OPCIONES_POR_DEFECTO = [{ etiqueta: 'Sí' }, { etiqueta: 'No' }, { etiqueta: 'Sin revisar' }];

/**
 * Los tipos de equipo pertenecen a la sucursal, no al técnico que los creó: todo
 * el equipo de esa sucursal comparte el mismo catálogo.
 */
function contextoSucursal(req: Request): { usuarioId: number; sucursalId: number } {
  const usuarioId = req.auth?.userId;
  const sucursalId = req.auth?.sucursalId;
  if (!usuarioId) throw new HttpError(401, 'No autenticado');
  if (!sucursalId) throw new HttpError(409, 'Debes seleccionar una sucursal antes de continuar');
  return { usuarioId, sucursalId };
}

/** Busca un tipo dentro de la sucursal activa o corta con 404. */
async function buscarTipoDeSucursal(req: Request, id: number): Promise<TipoEquipoPersonalizado> {
  const { sucursalId } = contextoSucursal(req);
  const tipo = await TipoEquipoPersonalizado.findOne({ where: { id, sucursalId } });
  if (!tipo) throw new HttpError(404, 'Tipo de equipo no encontrado');
  return tipo;
}

/** Lista los tipos de equipo de la sucursal activa. */
export const listarTiposEquipo = asyncHandler(async (req: Request, res: Response) => {
  const { sucursalId } = contextoSucursal(req);

  const tipos = await TipoEquipoPersonalizado.findAll({
    where: { sucursalId, activo: true },
    order: [['nombre', 'ASC']]
  });

  res.json(tipos);
});

/** Crea un tipo de equipo para la sucursal activa. */
export const crearTipoEquipo = asyncHandler(async (req: Request, res: Response) => {
  const { usuarioId, sucursalId } = contextoSucursal(req);
  const data = crearTipoSchema.parse(req.body);

  // Si ya existía y estaba dado de baja, se reactiva en lugar de chocar con el índice único.
  const existente = await TipoEquipoPersonalizado.findOne({ where: { sucursalId, nombre: data.nombre } });
  if (existente) {
    if (existente.activo)
      throw new HttpError(409, 'Ya existe un tipo de equipo con ese nombre en esta sucursal');
    await existente.update({ activo: true });
    res.status(200).json(existente);
    return;
  }

  try {
    const tipo = await TipoEquipoPersonalizado.create({
      nombre: data.nombre,
      usuarioId,
      sucursalId,
      activo: true
    });
    res.status(201).json(tipo);
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new HttpError(409, 'Ya existe un tipo de equipo con ese nombre en esta sucursal');
    }
    throw err;
  }
});

/** Renombra un tipo de equipo de la sucursal activa. */
export const actualizarTipoEquipo = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await buscarTipoDeSucursal(req, paramId(req));
  const data = actualizarTipoSchema.parse(req.body);

  if (data.nombre === undefined) {
    res.json(tipo);
    return;
  }

  try {
    await tipo.update({ nombre: data.nombre });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw new HttpError(409, 'Ya existe un tipo de equipo con ese nombre en esta sucursal');
    }
    throw err;
  }

  res.json(tipo);
});

/** Da de baja un tipo de equipo. Se conserva la fila si algún equipo la referencia. */
export const eliminarTipoEquipo = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await buscarTipoDeSucursal(req, paramId(req));

  const equiposAsociados = await Equipo.count({ where: { tipoEquipoPersonalizadoId: tipo.id } });
  if (equiposAsociados > 0) {
    // Baja lógica: los equipos ya cargados siguen mostrando el nombre correcto.
    await tipo.update({ activo: false });
    res.status(204).send();
    return;
  }

  await tipo.destroy();
  res.status(204).send();
});

/** Lista los chequeos configurados para un tipo de equipo de la sucursal activa. */
export const listarChequeos = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await buscarTipoDeSucursal(req, paramId(req, 'tipoId'));

  const chequeos = await ChequeoPersonalizado.findAll({
    where: { tipoEquipoPersonalizadoId: tipo.id },
    order: [
      ['orden', 'ASC'],
      ['id', 'ASC']
    ]
  });

  res.json(chequeos);
});

/** Reemplaza la lista completa de chequeos de un tipo de equipo. */
export const guardarChequeos = asyncHandler(async (req: Request, res: Response) => {
  const tipo = await buscarTipoDeSucursal(req, paramId(req, 'tipoId'));
  const data = guardarChequeosSchema.parse(req.body);

  await sequelize.transaction(async (t) => {
    await ChequeoPersonalizado.destroy({
      where: { tipoEquipoPersonalizadoId: tipo.id },
      transaction: t
    });

    if (data.chequeos.length > 0) {
      await ChequeoPersonalizado.bulkCreate(
        data.chequeos.map((c, idx) => ({
          tipoEquipoPersonalizadoId: tipo.id,
          texto: c.texto,
          opciones: c.opciones ?? OPCIONES_POR_DEFECTO,
          orden: idx
        })),
        { transaction: t }
      );
    }
  });

  const nuevosChequeos = await ChequeoPersonalizado.findAll({
    where: { tipoEquipoPersonalizadoId: tipo.id },
    order: [['orden', 'ASC']]
  });

  res.status(201).json(nuevosChequeos);
});
