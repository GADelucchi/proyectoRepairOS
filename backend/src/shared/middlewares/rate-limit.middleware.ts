import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

/**
 * Los tests de integración registran y loguean decenas de veces desde la misma
 * IP: con los límites activos se bloquearían a sí mismos.
 */
const skip = () => process.env.NODE_ENV === 'test';

/**
 * Límites de tráfico.
 *
 * El del login va en dos niveles a propósito: por IP frena el barrido desde una
 * sola máquina, y por email frena el ataque distribuido, que es el que importa
 * cuando el atacante ya sabe a qué cuenta apuntar (`admin@…` figura en el README).
 */

export const limitadorGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  skip,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Esperá unos minutos.' }
});

export const limitadorLoginPorIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  skip,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Demasiados intentos de ingreso desde esta conexión. Esperá 15 minutos.' }
});

/**
 * Registro público: cada alta crea un taller entero, así que el límite es más
 * duro que el del login y cuenta también las altas exitosas.
 */
export const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  skip,
  legacyHeaders: false,
  message: { message: 'Demasiados registros desde esta conexión. Probá de nuevo en una hora.' }
});

export const limitadorLoginPorEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  skip,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // Agrupa por cuenta: 5 intentos fallidos contra el mismo email, vengan de
  // donde vengan. Se cae a la IP si el cuerpo no trae un email usable.
  keyGenerator: (req: Request) => {
    const email = (req.body?.email ?? '').toString().trim().toLowerCase();
    return email ? `email:${email}` : ipKeyGenerator(req.ip ?? '');
  },
  message: { message: 'Demasiados intentos con esta cuenta. Esperá 15 minutos.' }
});

/**
 * Recuperar contraseña y verificar email: cada pedido puede mandar un email,
 * así que se limita para que nadie use el sistema para llenarle la casilla a otro.
 */
export const limitadorRecuperacion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  skip,
  legacyHeaders: false,
  message: { message: 'Demasiados pedidos. Esperá 15 minutos.' }
});
