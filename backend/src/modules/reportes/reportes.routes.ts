import { Router } from 'express';
import { authenticate, requireRole, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as estadisticas from './estadisticas.controller';
import * as reportes from './reportes.controller';

export const reportesRoutes = Router();

reportesRoutes.use(authenticate);

reportesRoutes.get('/caja', reportes.caja);
reportesRoutes.get('/caja/movimientos', reportes.movimientosDeCaja);
reportesRoutes.get('/tablero', requireSucursal, estadisticas.tablero);
// Los informes son del admin; la caja la usa también el mostrador para cerrar el día.
reportesRoutes.get('/resumen', requireRole('admin'), estadisticas.reportes);
