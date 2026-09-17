import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { caja, movimientosDeCaja } from '../controllers/reporteController';

const router = Router();

router.use(authenticate);

// Primer informe del módulo. Los que vengan cuelgan de acá.
router.get('/caja', caja);
router.get('/caja/movimientos', movimientosDeCaja);

export default router;
