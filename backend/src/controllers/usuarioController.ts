import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import { User } from '../models';
import { invalidarCacheUsuario } from '../middlewares/auth';
import { tallerIdDe } from '../utils/tenant';
import {
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  cambiarPasswordSchema
} from '../validators/usuarioValidators';

const PUBLIC_ATTRS = ['id', 'nombre', 'apellido', 'email', 'rol', 'activo', 'createdAt'] as const;

/** Busca un usuario del taller del admin autenticado o corta con 404. */
async function buscarUsuarioDelTaller(req: Request): Promise<User> {
  const usuario = await User.findOne({ where: { id: paramId(req), tallerId: tallerIdDe(req) } });
  if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
  return usuario;
}

export const listarUsuarios = asyncHandler(async (req: Request, res: Response) => {
  const usuarios = await User.findAll({
    where: { tallerId: tallerIdDe(req) },
    attributes: [...PUBLIC_ATTRS],
    order: [['nombre', 'ASC']]
  });
  res.json(usuarios);
});

export const crearUsuario = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const data = crearUsuarioSchema.parse(req.body);

  // El email es único en toda la base, no por taller: el login pide solo email
  // y contraseña, así que dos talleres no pueden compartir una dirección.
  const existente = await User.findOne({ where: { email: data.email } });
  if (existente) throw new HttpError(409, 'Ya existe un usuario con ese email');

  const passwordHash = await bcrypt.hash(data.password, 10);
  const usuario = await User.create({
    tallerId,
    nombre: data.nombre,
    apellido: data.apellido,
    email: data.email,
    passwordHash,
    rol: data.rol
  });

  res.status(201).json({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo
  });
});

export const actualizarUsuario = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await buscarUsuarioDelTaller(req);

  const data = actualizarUsuarioSchema.parse(req.body);
  await usuario.update(data);

  // Cambiar rol o dar de baja tiene que surtir efecto ya, no cuando expire el token.
  invalidarCacheUsuario(usuario.id);

  res.json({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rol: usuario.rol,
    activo: usuario.activo
  });
});

export const cambiarPassword = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await buscarUsuarioDelTaller(req);

  const { password } = cambiarPasswordSchema.parse(req.body);
  usuario.passwordHash = await bcrypt.hash(password, 10);
  await usuario.save();
  res.status(204).send();
});

/** Baja lógica: preserva el historial de órdenes asociado al técnico. */
export const desactivarUsuario = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await buscarUsuarioDelTaller(req);
  await usuario.update({ activo: false });
  invalidarCacheUsuario(usuario.id);
  res.status(204).send();
});
