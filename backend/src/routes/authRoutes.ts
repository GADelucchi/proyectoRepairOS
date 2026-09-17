import { Router } from 'express';
import { registrar, login, seleccionarSucursal, me } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { limitadorLoginPorEmail, limitadorLoginPorIp, limitadorRegistro } from '../middlewares/rateLimit';

const router = Router();

router.post('/registro', limitadorRegistro, registrar);
router.post('/login', limitadorLoginPorIp, limitadorLoginPorEmail, login);
router.post('/seleccionar-sucursal', authenticate, seleccionarSucursal);
router.get('/me', authenticate, me);

export default router;
