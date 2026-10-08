import { Router } from 'express';
import { authenticate, requirePlataforma } from '../../shared/middlewares/auth.middleware';
import * as plataforma from './plataforma.controller';

/**
 * Administración de la plataforma: lo único de la API que cruza talleres.
 * Solo para los emails de `PLATFORM_ADMIN_EMAILS`.
 */
export const plataformaRoutes = Router();

plataformaRoutes.use(authenticate, requirePlataforma);

plataformaRoutes.get('/resumen', plataforma.resumen);
plataformaRoutes.get('/planes', plataforma.listarPlanes);
plataformaRoutes.get('/talleres', plataforma.listarTalleres);
plataformaRoutes.get('/talleres/:id', plataforma.detalleTaller);
plataformaRoutes.put('/talleres/:id/suscripcion', plataforma.actualizarSuscripcion);
plataformaRoutes.get('/usuarios', plataforma.listarUsuarios);
