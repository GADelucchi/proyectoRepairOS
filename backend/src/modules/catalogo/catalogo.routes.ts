import { Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as catalogo from './catalogo.controller';

/**
 * Catálogo público del stock: sin sesión, con el código público del taller.
 *
 * Se puede consumir desde cualquier sitio (la web del taller, una tienda, una
 * planilla): CORS abierto y sin cookies. El límite frena a quien recorra
 * códigos al azar.
 */
export const catalogoRoutes = Router();

catalogoRoutes.use(
  cors({ origin: '*', credentials: false, methods: ['GET'] }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Demasiadas consultas. Esperá unos minutos.' }
  })
);

catalogoRoutes.get('/:codigo', catalogo.consultar);
