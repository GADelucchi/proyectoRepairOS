import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  listarSolicitudes,
  contarPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
  cancelarSolicitud
} from '../controllers/solicitudController';

const router = Router();

router.use(authenticate);

// Ver el estado de los pedidos es de todos: quien pidió necesita saber si le
// aprobaron. Resolverlos, en cambio, es potestad del admin.
router.get('/', listarSolicitudes);
router.get('/pendientes/contador', contarPendientes);
router.post('/:id/cancelar', cancelarSolicitud);

router.post('/:id/aprobar', requireRole('admin'), aprobarSolicitud);
router.post('/:id/rechazar', requireRole('admin'), rechazarSolicitud);

export default router;
