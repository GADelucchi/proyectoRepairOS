import { Router } from 'express';
import { authenticate, requireSucursal } from '../middlewares/auth';
import { upload } from '../middlewares/upload';
import {
  listarOrdenes,
  obtenerOrden,
  crearOrden,
  actualizarOrden,
  cambiarEstadoOrden,
  entregarOrden,
  solicitarFiado,
  actualizarPresupuesto,
  reemplazarChequeos,
  subirImagenes,
  eliminarImagen,
  guardarFirma,
  descargarPdf
} from '../controllers/ordenController';

const router = Router();

router.use(authenticate, requireSucursal);

router.get('/', listarOrdenes);
router.get('/:id', obtenerOrden);
router.post('/', crearOrden);
router.put('/:id', actualizarOrden);
router.put('/:id/estado', cambiarEstadoOrden);
router.post('/:id/entrega', entregarOrden);
router.post('/:id/entrega/solicitar', solicitarFiado);
router.put('/:id/presupuesto', actualizarPresupuesto);
router.put('/:id/chequeos', reemplazarChequeos);
router.post('/:id/imagenes', upload.array('imagenes', 10), subirImagenes);
router.delete('/:id/imagenes/:imagenId', eliminarImagen);
router.post('/:id/firma', guardarFirma);
router.get('/:id/pdf', descargarPdf);

export default router;
