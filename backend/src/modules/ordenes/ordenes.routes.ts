import { Router } from 'express';
import { authenticate, requireSucursal } from '../../shared/middlewares/auth.middleware';
import { MAX_ARCHIVOS, upload } from '../../shared/middlewares/upload.middleware';
import * as ordenes from './ordenes.controller';

export const ordenesRoutes = Router();

ordenesRoutes.use(authenticate, requireSucursal);

ordenesRoutes.get('/', ordenes.listarOrdenes);
ordenesRoutes.post('/', ordenes.crearOrden);
ordenesRoutes.get('/:id', ordenes.obtenerOrden);
ordenesRoutes.put('/:id', ordenes.actualizarOrden);
ordenesRoutes.put('/:id/estado', ordenes.cambiarEstadoOrden);
ordenesRoutes.put('/:id/presupuesto', ordenes.actualizarPresupuesto);
ordenesRoutes.put('/:id/chequeos', ordenes.reemplazarChequeos);

ordenesRoutes.post('/:id/entrega', ordenes.entregarOrden);
ordenesRoutes.post('/:id/entrega/solicitar', ordenes.solicitarFiado);

ordenesRoutes.post('/:id/imagenes', upload.array('imagenes', MAX_ARCHIVOS), ordenes.subirImagenes);
ordenesRoutes.delete('/:id/imagenes/:imagenId', ordenes.eliminarImagen);

ordenesRoutes.post('/:id/firma', ordenes.guardarFirma);
ordenesRoutes.get('/:id/firma', ordenes.obtenerFirma);
ordenesRoutes.get('/:id/pdf', ordenes.descargarPdf);
