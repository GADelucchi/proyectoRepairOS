import { Router } from 'express';
import { authenticate, requireRole, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as stock from './stock.controller';

export const stockRoutes = Router();

// Cargar y vender es tarea de mostrador; cada equipo queda en la sucursal que lo cargó.
stockRoutes.use(authenticate, requireSucursal);

stockRoutes.get('/', stock.listarStock);
stockRoutes.get('/:id', stock.obtenerEquipoStock);
stockRoutes.post('/', stock.crearEquipoStock);
stockRoutes.put('/:id', stock.actualizarEquipoStock);
// Borrar baja el valor del stock: queda para un admin.
stockRoutes.delete('/:id', requireRole('admin'), stock.eliminarEquipoStock);
