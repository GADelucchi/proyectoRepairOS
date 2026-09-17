import { z } from 'zod';
import { MEDIOS_PAGO } from '../models/CuentaMovimiento';

/** El motivo es obligatorio: quien aprueba tiene que saber qué está aprobando. */
const motivo = z.string().trim().min(1, 'Hay que explicar el motivo del pedido').max(500);

export const solicitarFiadoSchema = z.object({
  montoTotal: z.number().nonnegative(),
  montoAbonado: z.number().nonnegative(),
  medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
  motivo
});

export const solicitarAjusteSchema = z.object({
  monto: z.number().positive('El monto del ajuste debe ser mayor a cero'),
  /** `debito` suma deuda al cliente; `credito` se la descuenta. */
  direccion: z.enum(['debito', 'credito']),
  motivo
});

export const resolverSolicitudSchema = z.object({
  respuesta: z.string().trim().max(500).optional().nullable()
});
