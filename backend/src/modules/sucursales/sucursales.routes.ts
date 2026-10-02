import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth.middleware';
import * as sucursales from './sucursales.controller';

export const sucursalesRoutes = Router();
const soloAdmin = requireRole('admin');

sucursalesRoutes.use(authenticate);

sucursalesRoutes.get('/mis-sucursales', sucursales.misSucursales);

sucursalesRoutes.get('/', soloAdmin, sucursales.listarSucursales);
sucursalesRoutes.post('/', soloAdmin, sucursales.crearSucursal);
sucursalesRoutes.put('/:id', soloAdmin, sucursales.actualizarSucursal);
sucursalesRoutes.delete('/:id', soloAdmin, sucursales.desactivarSucursal);

sucursalesRoutes.get('/:id/permisos', soloAdmin, sucursales.listarPermisos);
sucursalesRoutes.post('/:id/permisos', soloAdmin, sucursales.otorgarPermiso);
sucursalesRoutes.delete('/:id/permisos/:usuarioId', soloAdmin, sucursales.revocarPermiso);
