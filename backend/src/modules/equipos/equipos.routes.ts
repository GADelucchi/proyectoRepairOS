import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/auth.middleware';
import * as equipos from './equipos.controller';

export const equiposRoutes = Router();

equiposRoutes.use(authenticate);

equiposRoutes.get('/', equipos.listarEquipos);
equiposRoutes.get('/generar/numero-serie', equipos.generarNumeroSerie);
equiposRoutes.get('/:id', equipos.obtenerEquipo);
equiposRoutes.post('/', equipos.crearEquipo);
equiposRoutes.put('/:id', equipos.actualizarEquipo);
equiposRoutes.delete('/:id', equipos.eliminarEquipo);
