import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as seguimiento from './seguimiento.controller';

/**
 * Seguimiento público de una orden: sin sesión, con el código del remito. El
 * límite frena a quien intente adivinar códigos a fuerza de pedidos.
 */
export const seguimientoRoutes = Router();

seguimientoRoutes.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Demasiadas consultas. Esperá unos minutos.' }
  })
);

seguimientoRoutes.get('/:codigo', seguimiento.consultar);
