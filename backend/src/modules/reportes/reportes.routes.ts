import { Router } from 'express';
import { authenticate, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as estadisticas from './estadisticas.controller';
import * as reportes from './reportes.controller';

export const reportesRoutes = Router();

reportesRoutes.use(authenticate);

reportesRoutes.get('/caja', reportes.caja);
reportesRoutes.get('/caja/movimientos', reportes.movimientosDeCaja);
reportesRoutes.get('/tablero', requireSucursal, estadisticas.tablero);
reportesRoutes.get('/resumen', estadisticas.reportes);
