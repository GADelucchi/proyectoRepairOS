import { Request, Response } from 'express';
import { usuarioDe } from '../../shared/http/request-context';
import {
  loginSchema,
  pedirEmailSchema,
  registroSchema,
  restablecerSchema,
  seleccionarSucursalSchema,
  tokenSchema
} from './auth.schemas';
import * as auth from './auth.service';

/** Alta de un taller nuevo con su administrador (ver `auth.registrar`). */
export async function registrar(req: Request, res: Response): Promise<void> {
  const data = registroSchema.parse(req.body);
  res.status(201).json(await auth.registrar(data));
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  res.json(await auth.login(email, password));
}

/** Segundo paso del login: emite un token nuevo con la sucursal elegida. */
export async function seleccionarSucursal(req: Request, res: Response): Promise<void> {
  const { sucursalId } = seleccionarSucursalSchema.parse(req.body);
  res.json(await auth.seleccionarSucursal(usuarioDe(req).userId, sucursalId));
}

/** Perfil de la sesión: usuario, taller, suscripción y sucursales disponibles. */
export async function me(req: Request, res: Response): Promise<void> {
  const { userId, sucursalId } = usuarioDe(req);
  res.json(await auth.perfil(userId, sucursalId));
}

export async function recuperarPassword(req: Request, res: Response): Promise<void> {
  const { email } = pedirEmailSchema.parse(req.body);
  res.json(await auth.recuperarPassword(email));
}

/** Elige la contraseña nueva con el link del email. */
export async function restablecerPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = restablecerSchema.parse(req.body);
  res.json(await auth.restablecerPassword(token, password));
}

/** Confirma el email con el link que se mandó al registrarse. */
export async function verificarEmail(req: Request, res: Response): Promise<void> {
  const { token } = tokenSchema.parse(req.body);
  res.json(await auth.verificarEmail(token));
}

/** Vuelve a mandar el email de verificación. Misma respuesta exista o no la cuenta. */
export async function reenviarVerificacion(req: Request, res: Response): Promise<void> {
  const { email } = pedirEmailSchema.parse(req.body);
  res.json(await auth.reenviarVerificacion(email));
}
