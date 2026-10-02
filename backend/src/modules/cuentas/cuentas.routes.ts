import { Router } from 'express';
import { authenticate, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as cuentas from './cuentas.controller';

export const cuentasRoutes = Router();

// Cobrar es tarea de mostrador: no hace falta ser admin, pero sí tener sucursal
// elegida, para que cada movimiento quede atado al local que cobró.
cuentasRoutes.use(authenticate, requireSucursal);

cuentasRoutes.get('/', cuentas.listarCuentas);
cuentasRoutes.get('/:clienteId', cuentas.detalleCuenta);
cuentasRoutes.post('/:clienteId/pagos', cuentas.registrarCobro);
// Cualquiera pide el ajuste; aprobarlo es de admin (ver /solicitudes).
cuentasRoutes.post('/:clienteId/ajustes', cuentas.solicitarAjuste);
