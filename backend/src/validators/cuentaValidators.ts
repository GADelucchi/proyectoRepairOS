import { z } from 'zod';
import { MEDIOS_PAGO } from '../models/CuentaMovimiento';

/** Cobro contra el saldo del cliente, sin imputar a una orden en particular. */
export const registrarPagoSchema = z.object({
  monto: z.number().positive('El monto del cobro debe ser mayor a cero'),
  medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
  nota: z.string().trim().max(255).optional().nullable()
});
