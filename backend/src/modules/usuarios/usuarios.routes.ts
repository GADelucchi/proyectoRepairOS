import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth.middleware';
import * as usuarios from './usuarios.controller';

export const usuariosRoutes = Router();

usuariosRoutes.use(authenticate, requireRole('admin'));

usuariosRoutes.get('/', usuarios.listarUsuarios);
usuariosRoutes.post('/', usuarios.crearUsuario);
usuariosRoutes.put('/:id', usuarios.actualizarUsuario);
usuariosRoutes.put('/:id/password', usuarios.cambiarPassword);
usuariosRoutes.delete('/:id', usuarios.desactivarUsuario);
