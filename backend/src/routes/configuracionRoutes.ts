import { Router } from 'express';
import * as configuracionController from '../controllers/configuracionController';
import { authenticate, requireSucursal } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren autenticación y sucursal seleccionada
router.use(authenticate, requireSucursal);

// Tipos de equipo personalizados
router.get('/tipos-equipo', configuracionController.listarTiposEquipo);
router.post('/tipos-equipo', configuracionController.crearTipoEquipo);
router.put('/tipos-equipo/:id', configuracionController.actualizarTipoEquipo);
router.delete('/tipos-equipo/:id', configuracionController.eliminarTipoEquipo);

// Chequeos personalizados
router.get('/tipos-equipo/:tipoId/chequeos', configuracionController.listarChequeos);
router.post('/tipos-equipo/:tipoId/chequeos', configuracionController.guardarChequeos);

export default router;
