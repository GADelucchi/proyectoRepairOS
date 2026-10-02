import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/auth.middleware';
import * as reportes from './reportes.controller';

export const reportesRoutes = Router();

reportesRoutes.use(authenticate);

reportesRoutes.get('/caja', reportes.caja);
reportesRoutes.get('/caja/movimientos', reportes.movimientosDeCaja);
