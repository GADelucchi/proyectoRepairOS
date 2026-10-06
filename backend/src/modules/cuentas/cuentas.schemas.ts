import { z } from 'zod';
import { MEDIOS_PAGO } from '../../models/CuentaMovimiento';
import { booleanoEnQuery, busqueda, monedaConDefecto, montoPositivo } from '../../shared/validation/campos';

/** Cobro contra el saldo del cliente, sin imputar a una orden en particular. */
export const registrarCobroSchema = z.object({
  monto: montoPositivo,
  /** El cobro descuenta la deuda en esta moneda. */
  moneda: monedaConDefecto,
  medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
  nota: z.string().trim().max(255).optional().nullable()
});

export const listarCuentasQuery = z.object({
  search: busqueda,
  todos: booleanoEnQuery
});
