import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/auth.middleware';
import * as notificaciones from './notificaciones.controller';

/** La campanita: cada usuario ve y marca solo sus propios avisos. */
export const notificacionesRoutes = Router();

notificacionesRoutes.use(authenticate);

notificacionesRoutes.get('/', notificaciones.listar);
notificacionesRoutes.get('/contador', notificaciones.contarNoLeidas);
notificacionesRoutes.post('/leer-todas', notificaciones.marcarTodasLeidas);
notificacionesRoutes.post('/:id/leer', notificaciones.marcarLeida);
