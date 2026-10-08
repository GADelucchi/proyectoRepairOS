import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth.middleware';
import * as plan from './plan.controller';

/** Ajuste del taller a su plan cuando quedó excedido (ver `limites.service`). */
export const planRoutes = Router();

planRoutes.use(authenticate);
planRoutes.get('/exceso', plan.obtenerExceso);
planRoutes.post('/ajustar', requireRole('admin'), plan.ajustar);
