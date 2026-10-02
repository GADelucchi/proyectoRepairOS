import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth.middleware';
import * as clientes from './clientes.controller';

export const clientesRoutes = Router();

clientesRoutes.use(authenticate);

clientesRoutes.get('/', clientes.listarClientes);
clientesRoutes.get('/:id', clientes.obtenerCliente);
clientesRoutes.post('/', clientes.crearCliente);
clientesRoutes.put('/:id', clientes.actualizarCliente);
clientesRoutes.delete('/:id', clientes.eliminarCliente);
// Es irreversible y borra datos sensibles de equipos y órdenes: solo un admin.
clientesRoutes.post('/:id/anonimizar', requireRole('admin'), clientes.anonimizarCliente);
