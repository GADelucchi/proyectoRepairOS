import { Router } from 'express';
import { authenticate, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as configuracion from './configuracion.controller';

export const configuracionRoutes = Router();

configuracionRoutes.use(authenticate, requireSucursal);

configuracionRoutes.get('/tipos-equipo', configuracion.listarTiposEquipo);
configuracionRoutes.post('/tipos-equipo', configuracion.crearTipoEquipo);
configuracionRoutes.put('/tipos-equipo/:id', configuracion.actualizarTipoEquipo);
configuracionRoutes.delete('/tipos-equipo/:id', configuracion.eliminarTipoEquipo);

configuracionRoutes.get('/tipos-equipo/:tipoId/chequeos', configuracion.listarChequeos);
configuracionRoutes.post('/tipos-equipo/:tipoId/chequeos', configuracion.guardarChequeos);
