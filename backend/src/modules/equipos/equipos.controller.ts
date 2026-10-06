import { Request, Response } from 'express';
import { ForeignKeyConstraintError, Op, WhereOptions } from 'sequelize';
import { AccesoSensible, Cliente, Equipo, TipoEquipoPersonalizado } from '../../models';
import { EquipoAttributes } from '../../models/Equipo';
import { errores } from '../../shared/http/http-error';
import { paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { exigirTipoDelTaller } from '../configuracion/tipos-equipo.service';
import {
  actualizarEquipoSchema,
  crearEquipoSchema,
  listarEquiposQuery,
  obtenerEquipoQuery
} from './equipos.schemas';
import { cifrarCredenciales, serializarEquipo } from './equipos.service';
import { generarNumeroSerieUnico } from './numero-serie';

const LIMITE_LISTADO = 100;

const INCLUDES = [
  { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido'] },
  { model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }
];

async function buscarEquipoDelTaller(req: Request): Promise<Equipo> {
  const equipo = await Equipo.findOne({
    where: { id: paramId(req), tallerId: tallerIdDe(req) },
    include: INCLUDES
  });
  if (!equipo) throw errores.noEncontrado('Equipo');
  return equipo;
}

async function exigirClienteDelTaller(clienteId: number, tallerId: number): Promise<void> {
  if (!(await Cliente.count({ where: { id: clienteId, tallerId } }))) throw errores.noEncontrado('Cliente');
}

export async function listarEquipos(req: Request, res: Response): Promise<void> {
  const { search, clienteId } = listarEquiposQuery.parse(req.query);

  const where: WhereOptions<EquipoAttributes> = {
    tallerId: tallerIdDe(req),
    ...(clienteId ? { clienteId } : {}),
    ...(search
      ? {
          [Op.or]: ['numeroSerie', 'marca', 'modelo'].map((campo) => ({
            [campo]: { [Op.like]: `%${search}%` }
          }))
        }
      : {})
  };

  const equipos = await Equipo.findAll({
    where,
    include: INCLUDES,
    order: [['createdAt', 'DESC']],
    limit: LIMITE_LISTADO
  });
  res.json(equipos.map((e) => serializarEquipo(e, false)));
}

/**
 * Con `?reveal=true` devuelve las credenciales descifradas y deja registrado
 * quién las vio: es el dato que más duele si se filtra.
 */
export async function obtenerEquipo(req: Request, res: Response): Promise<void> {
  const equipo = await buscarEquipoDelTaller(req);
  const { reveal } = obtenerEquipoQuery.parse(req.query);

  if (reveal) {
    const usuario = usuarioDe(req);
    await AccesoSensible.create({
      usuarioId: usuario.userId,
      equipoId: equipo.id,
      sucursalId: usuario.sucursalId ?? null,
      ip: req.ip ?? null
    });
  }

  res.json(serializarEquipo(equipo, reveal));
}

export async function crearEquipo(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const { claveDesbloqueo, cuentaUsuario, cuentaPassword, ...datos } = crearEquipoSchema.parse(req.body);

  await exigirClienteDelTaller(datos.clienteId, tallerId);
  await exigirTipoDelTaller(datos.tipoEquipoPersonalizadoId, tallerId);

  const equipo = await Equipo.create({
    ...datos,
    tallerId,
    ...cifrarCredenciales({ claveDesbloqueo, cuentaUsuario, cuentaPassword })
  });
  // Con dueño y tipo: la pantalla ofrece imprimir la etiqueta QR del equipo recién creado.
  await equipo.reload({ include: INCLUDES });
  res.status(201).json(serializarEquipo(equipo, false));
}

export async function actualizarEquipo(req: Request, res: Response): Promise<void> {
  const equipo = await buscarEquipoDelTaller(req);
  const { claveDesbloqueo, cuentaUsuario, cuentaPassword, ...datos } = actualizarEquipoSchema.parse(req.body);

  // El dueño y el tipo nuevos tienen que ser del mismo taller que el equipo.
  if (datos.clienteId !== undefined) await exigirClienteDelTaller(datos.clienteId, equipo.tallerId);
  if (datos.tipoEquipoPersonalizadoId !== undefined) {
    await exigirTipoDelTaller(datos.tipoEquipoPersonalizadoId, equipo.tallerId);
  }

  await equipo.update({
    ...datos,
    ...cifrarCredenciales({ claveDesbloqueo, cuentaUsuario, cuentaPassword })
  });
  await equipo.reload({ include: INCLUDES });
  res.json(serializarEquipo(equipo, false));
}

export async function eliminarEquipo(req: Request, res: Response): Promise<void> {
  const equipo = await buscarEquipoDelTaller(req);
  try {
    await equipo.destroy();
  } catch (err) {
    if (err instanceof ForeignKeyConstraintError) {
      throw errores.conflicto('No se puede eliminar: el equipo tiene órdenes asociadas');
    }
    throw err;
  }
  res.status(204).send();
}

export async function generarNumeroSerie(req: Request, res: Response): Promise<void> {
  res.json({ numeroSerie: await generarNumeroSerieUnico(tallerIdDe(req)) });
}
