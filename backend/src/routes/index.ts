import { Router } from 'express';
import authRoutes from './authRoutes';
import sucursalRoutes from './sucursalRoutes';
import usuarioRoutes from './usuarioRoutes';
import clienteRoutes from './clienteRoutes';
import cuentaRoutes from './cuentaRoutes';
import solicitudRoutes from './solicitudRoutes';
import reporteRoutes from './reporteRoutes';
import equipoRoutes from './equipoRoutes';
import ordenRoutes from './ordenRoutes';
import configuracionRoutes from './configuracionRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/sucursales', sucursalRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/clientes', clienteRoutes);
router.use('/cuentas', cuentaRoutes);
router.use('/solicitudes', solicitudRoutes);
router.use('/reportes', reporteRoutes);
router.use('/equipos', equipoRoutes);
router.use('/ordenes', ordenRoutes);
router.use('/configuracion', configuracionRoutes);

export default router;
