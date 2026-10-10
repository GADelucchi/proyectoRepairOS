import { Request, Response } from 'express';
import { paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { actualizarUsuarioSchema, cambiarPasswordSchema, crearUsuarioSchema } from './usuarios.schemas';
import * as usuarios from './usuarios.service';

function usuarioDelTaller(req: Request) {
  return usuarios.usuarioDelTaller(tallerIdDe(req), paramId(req));
}

export async function listarUsuarios(req: Request, res: Response): Promise<void> {
  res.json(await usuarios.listarUsuarios(tallerIdDe(req)));
}

export async function crearUsuario(req: Request, res: Response): Promise<void> {
  const data = crearUsuarioSchema.parse(req.body);
  const usuario = await usuarios.crearUsuario(tallerIdDe(req), usuarioDe(req).userId, data);
  res.status(201).json(usuarios.usuarioPublico(usuario));
}

export async function actualizarUsuario(req: Request, res: Response): Promise<void> {
  const usuario = await usuarioDelTaller(req);
  const data = actualizarUsuarioSchema.parse(req.body);
  await usuarios.actualizarUsuario(usuarioDe(req).userId, usuario, data);
  res.json(usuarios.usuarioPublico(usuario));
}

export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  const usuario = await usuarioDelTaller(req);
  const { password } = cambiarPasswordSchema.parse(req.body);
  await usuarios.cambiarPassword(usuario, password);
  res.status(204).send();
}

/** Baja lógica: preserva el historial de órdenes asociado al técnico. */
export async function desactivarUsuario(req: Request, res: Response): Promise<void> {
  await usuarios.desactivarUsuario(usuarioDe(req).userId, await usuarioDelTaller(req));
  res.status(204).send();
}
