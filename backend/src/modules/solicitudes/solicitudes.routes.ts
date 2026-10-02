import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth.middleware';
import * as solicitudes from './solicitudes.controller';

export const solicitudesRoutes = Router();

solicitudesRoutes.use(authenticate);

// Ver el estado de los pedidos es de todos; resolverlos, del admin.
solicitudesRoutes.get('/', solicitudes.listarSolicitudes);
solicitudesRoutes.get('/pendientes/contador', solicitudes.contarPendientes);
solicitudesRoutes.post('/:id/cancelar', solicitudes.cancelarSolicitud);

solicitudesRoutes.post('/:id/aprobar', requireRole('admin'), solicitudes.aprobarSolicitud);
solicitudesRoutes.post('/:id/rechazar', requireRole('admin'), solicitudes.rechazarSolicitud);
