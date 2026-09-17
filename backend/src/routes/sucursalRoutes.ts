import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  misSucursales,
  listarSucursales,
  crearSucursal,
  actualizarSucursal,
  desactivarSucursal,
  listarPermisos,
  otorgarPermiso,
  revocarPermiso
} from '../controllers/sucursalController';

const router = Router();

router.use(authenticate);

router.get('/mis-sucursales', misSucursales);

router.get('/', requireRole('admin'), listarSucursales);
router.post('/', requireRole('admin'), crearSucursal);
router.put('/:id', requireRole('admin'), actualizarSucursal);
router.delete('/:id', requireRole('admin'), desactivarSucursal);

router.get('/:id/permisos', requireRole('admin'), listarPermisos);
router.post('/:id/permisos', requireRole('admin'), otorgarPermiso);
router.delete('/:id/permisos/:usuarioId', requireRole('admin'), revocarPermiso);

export default router;
