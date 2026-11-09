import { Router } from 'express';
import { authenticate, requireRole, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as ventas from './ventas.controller';

export const ventasRoutes = Router();

// Vender es tarea de mostrador. Nada se borra: una venta se cancela, se anula o vence, y queda.
ventasRoutes.use(authenticate, requireSucursal);

ventasRoutes.get('/', ventas.listarVentas);
ventasRoutes.post('/', ventas.crearVenta);
// Costos y ganancias: solo admin.
ventasRoutes.get('/informe', requireRole('admin'), ventas.informe);
ventasRoutes.get('/:id', ventas.obtenerVenta);
ventasRoutes.get('/:id/pdf', ventas.descargarPdf);
ventasRoutes.post('/:id/pagos', ventas.pagarVenta);
ventasRoutes.post('/:id/reserva', ventas.extenderReserva);
// Cancelar devuelve los equipos al stock y puede sacar plata de la caja.
ventasRoutes.post('/:id/cancelar', requireRole('admin'), ventas.cancelarVenta);
// Anular da vuelta una venta completada: lo mismo, más lo que dejó en parte de pago.
ventasRoutes.post('/:id/anular', requireRole('admin'), ventas.anularVenta);
