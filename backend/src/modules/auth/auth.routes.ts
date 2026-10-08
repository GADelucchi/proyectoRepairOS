import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/auth.middleware';
import {
  limitadorLoginPorEmail,
  limitadorLoginPorIp,
  limitadorRecuperacion,
  limitadorRegistro
} from '../../shared/middlewares/rate-limit.middleware';
import * as auth from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/registro', limitadorRegistro, auth.registrar);
authRoutes.post('/login', limitadorLoginPorIp, limitadorLoginPorEmail, auth.login);
authRoutes.post('/seleccionar-sucursal', authenticate, auth.seleccionarSucursal);
authRoutes.get('/me', authenticate, auth.me);

authRoutes.post('/recuperar', limitadorRecuperacion, auth.recuperarPassword);
authRoutes.post('/restablecer', limitadorRecuperacion, auth.restablecerPassword);
authRoutes.post('/verificar-email', limitadorRecuperacion, auth.verificarEmail);
authRoutes.post('/reenviar-verificacion', limitadorRecuperacion, auth.reenviarVerificacion);
