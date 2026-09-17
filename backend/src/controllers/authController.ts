import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UniqueConstraintError } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../middlewares/errorHandler';
import { signToken } from '../utils/jwt';
import { loginSchema, registroSchema, seleccionarSucursalSchema } from '../validators/authValidators';
import { sequelize, User, Sucursal, Taller, Suscripcion } from '../models';
import { sucursalesDisponiblesPara, puedeAccederASucursal } from '../services/sucursalAccess';
import { finDeGracia, suscripcionDeTaller } from '../services/suscripcion';

/**
 * Alta de un taller nuevo.
 *
 * Quien se registra es el dueño: se crean el taller, su usuario administrador y
 * la suscripción en prueba dentro de una misma transacción, porque un taller sin
 * usuario (o al revés) dejaría una cuenta imposible de usar y de limpiar.
 *
 * Devuelve el token ya emitido: el alta deja al dueño adentro, sin pedirle que
 * repita las credenciales que acaba de elegir.
 */
export const registrar = asyncHandler(async (req: Request, res: Response) => {
  const data = registroSchema.parse(req.body);

  const existente = await User.findOne({ where: { email: data.email } });
  if (existente) throw new HttpError(409, 'Ya existe una cuenta con ese email');

  const passwordHash = await bcrypt.hash(data.password, 10);

  let usuario: User;
  try {
    usuario = await sequelize.transaction(async (t) => {
      const taller = await Taller.create({ nombre: data.nombreTaller }, { transaction: t });

      const nuevo = await User.create(
        {
          tallerId: taller.id,
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          passwordHash,
          rol: 'admin'
        },
        { transaction: t }
      );

      await Suscripcion.create(
        { tallerId: taller.id, estado: 'prueba', graciaHasta: finDeGracia() },
        { transaction: t }
      );

      return nuevo;
    });
  } catch (err) {
    // Dos registros con el mismo email en simultáneo: el índice único de la
    // base es el que decide, la consulta de arriba solo evita el caso común.
    if (err instanceof UniqueConstraintError) {
      throw new HttpError(409, 'Ya existe una cuenta con ese email');
    }
    throw err;
  }

  const token = signToken({ userId: usuario.id, tallerId: usuario.tallerId, rol: usuario.rol });

  res.status(201).json({
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: usuario.rol
    },
    suscripcion: await suscripcionDeTaller(usuario.tallerId)
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ where: { email } });
  if (!user || !user.activo) {
    throw new HttpError(401, 'Credenciales inválidas');
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    throw new HttpError(401, 'Credenciales inválidas');
  }

  const token = signToken({ userId: user.id, tallerId: user.tallerId, rol: user.rol });

  res.json({
    token,
    usuario: {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      rol: user.rol
    }
  });
});

export const seleccionarSucursal = asyncHandler(async (req: Request, res: Response) => {
  const { sucursalId } = seleccionarSucursalSchema.parse(req.body);
  if (!req.auth) throw new HttpError(401, 'No autenticado');

  const user = await User.findByPk(req.auth.userId);
  if (!user || !user.activo) {
    throw new HttpError(401, 'Cuenta no disponible');
  }

  const sucursal = await Sucursal.findOne({ where: { id: sucursalId, tallerId: user.tallerId } });
  if (!sucursal || !sucursal.activo) {
    throw new HttpError(404, 'Sucursal no encontrada');
  }

  if (!(await puedeAccederASucursal(user, sucursalId))) {
    throw new HttpError(403, 'No tienes acceso a esta sucursal');
  }

  const token = signToken({
    userId: user.id,
    tallerId: user.tallerId,
    rol: req.auth.rol,
    sucursalId
  });
  res.json({ token, sucursal: { id: sucursal.id, nombre: sucursal.nombre } });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new HttpError(401, 'No autenticado');

  const user = await User.findByPk(req.auth.userId, {
    include: [{ model: Taller, as: 'taller', attributes: ['id', 'nombre'] }]
  });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');

  const sucursalesDisponibles = await sucursalesDisponiblesPara(user);

  // Si la sucursal del token se desactivó o dejó de estar disponible, se limpia
  // para que la app pida elegir de nuevo.
  const sucursalActualId =
    req.auth.sucursalId && sucursalesDisponibles.some((s) => s.id === req.auth?.sucursalId)
      ? req.auth.sucursalId
      : null;

  const taller = (user as any).taller as Taller | null;

  res.json({
    id: user.id,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    rol: user.rol,
    taller: taller ? { id: taller.id, nombre: taller.nombre } : null,
    suscripcion: await suscripcionDeTaller(user.tallerId),
    sucursalActualId,
    sucursales: sucursalesDisponibles.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
      telefono: s.telefono,
      activo: s.activo
    }))
  });
});
