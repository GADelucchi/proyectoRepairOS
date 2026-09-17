import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  listarEquipos,
  obtenerEquipo,
  crearEquipo,
  actualizarEquipo,
  eliminarEquipo,
  generarNumeroSerie
} from '../controllers/equipoController';

const router = Router();

router.use(authenticate);

router.get('/', listarEquipos);
router.get('/generar/numero-serie', generarNumeroSerie);
router.get('/:id', obtenerEquipo);
router.post('/', crearEquipo);
router.put('/:id', actualizarEquipo);
router.delete('/:id', eliminarEquipo);

export default router;
