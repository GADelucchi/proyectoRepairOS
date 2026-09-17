import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarPassword,
  desactivarUsuario
} from '../controllers/usuarioController';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);
router.put('/:id/password', cambiarPassword);
router.delete('/:id', desactivarUsuario);

export default router;
