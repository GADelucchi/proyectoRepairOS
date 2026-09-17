import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { RolUsuario } from '../models/User';

export interface JwtPayload {
  userId: number;
  tallerId: number;
  rol: RolUsuario;
  sucursalId?: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
}
