import { z } from 'zod';
import { MEDIOS_PAGO } from '../../models/CuentaMovimiento';
import {
  booleanoEnQuery,
  busqueda,
  moneda,
  monedaConDefecto,
  montoPositivo
} from '../../shared/validation/campos';

/** Cobro contra el saldo del cliente, sin imputar a una orden en particular. */
export const registrarCobroSchema = z
  .object({
    /** La plata que entró. Sin `monedaDeuda`, descuenta la deuda en esta misma moneda. */
    monto: montoPositivo,
    moneda: monedaConDefecto,
    /** Pago de una deuda en otra moneda: cuánto de qué deuda cancela esa plata. */
    monedaDeuda: moneda.optional(),
    montoDeuda: montoPositivo.optional(),
    medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
    nota: z.string().trim().max(255).optional().nullable()
  })
  .refine((d) => (d.monedaDeuda === undefined) === (d.montoDeuda === undefined), {
    message: 'Hay que indicar la moneda y el monto de la deuda que se cancela',
    path: ['montoDeuda']
  })
  .refine((d) => d.monedaDeuda !== d.moneda, {
    message: 'La moneda del pago y la de la deuda son la misma',
    path: ['monedaDeuda']
  });

export const listarCuentasQuery = z.object({
  search: busqueda,
  todos: booleanoEnQuery
});
