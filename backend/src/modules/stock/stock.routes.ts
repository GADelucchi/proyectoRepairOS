import { Router } from 'express';
import { authenticate, requireRole, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as stock from './stock.controller';

export const stockRoutes = Router();

// Cargar y vender es tarea de mostrador; cada equipo queda en la sucursal que lo cargó.
// Los costos los ve solo un admin: el servicio los saca de la respuesta para el resto.
stockRoutes.use(authenticate, requireSucursal);

stockRoutes.get('/', stock.listarStock);
stockRoutes.get('/verificar', stock.verificarRepetido);
stockRoutes.get('/proveedores', stock.listarProveedores);
stockRoutes.get('/:id', stock.obtenerEquipoStock);
stockRoutes.post('/', stock.crearEquipoStock);
stockRoutes.put('/:id', stock.actualizarEquipoStock);
// Nada se borra: dar de baja saca el equipo del stock y deja el registro. Baja el valor del stock, es de admin.
stockRoutes.post('/:id/baja', requireRole('admin'), stock.darDeBajaEquipoStock);
// Lo que se le agrega después de comprarlo (reparaciones, repuestos): es costo, así que es de admin.
stockRoutes.post('/:id/costos', requireRole('admin'), stock.agregarCosto);
stockRoutes.post('/:id/costos/:costoId/anular', requireRole('admin'), stock.anularCosto);
