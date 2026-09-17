import { Request, Response } from 'express';
import { ForeignKeyConstraintError, Op } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import { Equipo, Cliente, AccesoSensible, TipoEquipoPersonalizado } from '../models';
import { crearEquipoSchema, actualizarEquipoSchema } from '../validators/equipoValidators';
import { encryptNullable, decryptNullable, mask } from '../utils/encryption';
import { generarNumeroSerieUnico } from '../utils/numeroSerie';
import { tallerIdDe } from '../utils/tenant';

function serializeEquipo(equipo: Equipo, reveal: boolean) {
  const plain = equipo.get({ plain: true }) as any;
  const sensibles = {
    claveDesbloqueo: plain.claveDesbloqueoEnc
      ? reveal
        ? decryptNullable(plain.claveDesbloqueoEnc)
        : mask()
      : null,
    cuentaUsuario: plain.cuentaUsuarioEnc
      ? reveal
        ? decryptNullable(plain.cuentaUsuarioEnc)
        : mask()
      : null,
    cuentaPassword: plain.cuentaPasswordEnc
      ? reveal
        ? decryptNullable(plain.cuentaPasswordEnc)
        : mask()
      : null
  };
  delete plain.claveDesbloqueoEnc;
  delete plain.cuentaUsuarioEnc;
  delete plain.cuentaPasswordEnc;
  return { ...plain, ...sensibles };
}

export const listarEquipos = asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim();
  const clienteId = req.query.clienteId ? Number(req.query.clienteId) : undefined;

  const where: any = { tallerId: tallerIdDe(req) };
  if (clienteId) where.clienteId = clienteId;
  if (search) {
    where[Op.or as any] = [
      { numeroSerie: { [Op.like]: `%${search}%` } },
      { marca: { [Op.like]: `%${search}%` } },
      { modelo: { [Op.like]: `%${search}%` } }
    ];
  }

  const equipos = await Equipo.findAll({
    where,
    include: [
      { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido'] },
      { model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }
    ],
    order: [['createdAt', 'DESC']],
    limit: 100
  });
  res.json(equipos.map((e) => serializeEquipo(e, false)));
});

export const obtenerEquipo = asyncHandler(async (req: Request, res: Response) => {
  const equipo = await Equipo.findOne({
    where: { id: paramId(req), tallerId: tallerIdDe(req) },
    include: [
      { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido'] },
      { model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }
    ]
  });
  if (!equipo) throw new HttpError(404, 'Equipo no encontrado');

  const reveal = req.query.reveal === 'true';

  // Los clientes y equipos son globales del taller, así que no se restringe la
  // lectura por sucursal. Lo que sí queda registrado es cada descifrado de las
  // credenciales: es el dato que más duele si se filtra.
  if (reveal) {
    if (!req.auth) throw new HttpError(401, 'No autenticado');
    await AccesoSensible.create({
      usuarioId: req.auth.userId,
      equipoId: equipo.id,
      sucursalId: req.auth.sucursalId ?? null,
      ip: req.ip ?? null
    });
  }

  res.json(serializeEquipo(equipo, reveal));
});

export const crearEquipo = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const data = crearEquipoSchema.parse(req.body);

  const cliente = await Cliente.findOne({ where: { id: data.clienteId, tallerId } });
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');

  const equipo = await Equipo.create({
    tallerId,
    clienteId: data.clienteId,
    tipoEquipoPersonalizadoId: data.tipoEquipoPersonalizadoId,
    marca: data.marca ?? null,
    modelo: data.modelo ?? null,
    color: data.color ?? null,
    numeroSerie: data.numeroSerie,
    claveDesbloqueoEnc: encryptNullable(data.claveDesbloqueo),
    cuentaUsuarioEnc: encryptNullable(data.cuentaUsuario),
    cuentaPasswordEnc: encryptNullable(data.cuentaPassword)
  });

  res.status(201).json(serializeEquipo(equipo, false));
});

export const actualizarEquipo = asyncHandler(async (req: Request, res: Response) => {
  const equipo = await Equipo.findOne({ where: { id: paramId(req), tallerId: tallerIdDe(req) } });
  if (!equipo) throw new HttpError(404, 'Equipo no encontrado');

  const data = actualizarEquipoSchema.parse(req.body);
  const updates: Record<string, unknown> = { ...data };
  delete updates.claveDesbloqueo;
  delete updates.cuentaUsuario;
  delete updates.cuentaPassword;

  if (data.claveDesbloqueo !== undefined) updates.claveDesbloqueoEnc = encryptNullable(data.claveDesbloqueo);
  if (data.cuentaUsuario !== undefined) updates.cuentaUsuarioEnc = encryptNullable(data.cuentaUsuario);
  if (data.cuentaPassword !== undefined) updates.cuentaPasswordEnc = encryptNullable(data.cuentaPassword);

  await equipo.update(updates);
  res.json(serializeEquipo(equipo, false));
});

export const eliminarEquipo = asyncHandler(async (req: Request, res: Response) => {
  const equipo = await Equipo.findOne({ where: { id: paramId(req), tallerId: tallerIdDe(req) } });
  if (!equipo) throw new HttpError(404, 'Equipo no encontrado');
  try {
    await equipo.destroy();
  } catch (err) {
    if (err instanceof ForeignKeyConstraintError) {
      throw new HttpError(409, 'No se puede eliminar: el equipo tiene órdenes asociadas');
    }
    throw err;
  }
  res.status(204).send();
});

export const generarNumeroSerie = asyncHandler(async (req: Request, res: Response) => {
  const numeroSerie = await generarNumeroSerieUnico(tallerIdDe(req));
  res.json({ numeroSerie });
});
