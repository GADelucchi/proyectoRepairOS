import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as portal from './portal.controller';

/**
 * Portal de clientes: público, sin cuenta. Cada intento fallido cuenta, así que
 * probar DNIs al azar desde una conexión se corta enseguida.
 */
export const portalRoutes = Router();

portalRoutes.post(
  '/:codigo/consulta',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: () => process.env.NODE_ENV === 'test',
    message: { message: 'Demasiados intentos. Esperá 15 minutos.' }
  }),
  portal.consultar
);
