import { Router } from 'express';
import { authenticate, requireSucursal } from '../middlewares/auth';
import {
  listarCuentas,
  detalleCuenta,
  registrarCobro,
  solicitarAjuste
} from '../controllers/cuentaController';

const router = Router();

// Cobrar es tarea de mostrador, así que no se pide rol admin; lo que sí se pide
// es sucursal elegida, para que cada movimiento quede atado al local que cobró.
router.use(authenticate, requireSucursal);

router.get('/', listarCuentas);
router.get('/:clienteId', detalleCuenta);
router.post('/:clienteId/pagos', registrarCobro);
// Cualquiera pide el ajuste; aprobarlo es de admin (ver /solicitudes).
router.post('/:clienteId/ajustes', solicitarAjuste);

export default router;
