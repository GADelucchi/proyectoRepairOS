import { z } from 'zod';
import { ESTADOS_ORDEN } from '../../models/Orden';
import { MEDIOS_PAGO } from '../../models/CuentaMovimiento';
import { fechaIsoOpcional, idPositivo, monto } from '../../shared/validation/campos';
import { clienteSchema } from '../clientes/clientes.schemas';
import { datosEquipoSchema } from '../equipos/equipos.schemas';
import { opcionChequeoSchema } from '../configuracion/configuracion.schemas';

const chequeoSchema = z.object({
  item: z.string().trim().min(1).max(150),
  // La etiqueta elegida entre las opciones del chequeo, no un valor fijo.
  resultado: z.string().trim().max(80).optional().nullable(),
  opciones: z.array(opcionChequeoSchema).min(1).optional(),
  orden: z.number().int().optional()
});

export const chequeosSchema = z.array(chequeoSchema);
export type ChequeoInput = z.infer<typeof chequeoSchema>;

const datosOrdenSchema = z.object({
  detallesEsteticos: z.string().optional().nullable(),
  reparacionSolicitada: z.string().trim().min(1, 'Indicá la reparación o revisión a realizar'),
  notasInternas: z.string().optional().nullable(),
  fechaPactada: fechaIsoOpcional,
  presupuestoMonto: monto.optional().nullable()
});

/**
 * Alta de una orden. El cliente y el equipo pueden ser existentes (por id) o
 * nuevos (con sus datos), y en ese caso se crean en la misma transacción.
 */
export const crearOrdenSchema = datosOrdenSchema
  .extend({
    clienteId: idPositivo.optional(),
    nuevoCliente: clienteSchema.optional(),
    equipoId: idPositivo.optional(),
    nuevoEquipo: datosEquipoSchema.optional(),
    chequeos: chequeosSchema.optional().default([])
  })
  .refine((d) => d.clienteId || d.nuevoCliente, {
    message: 'Indicá un cliente existente o los datos de uno nuevo',
    path: ['clienteId']
  })
  .refine((d) => d.equipoId || d.nuevoEquipo, {
    message: 'Indicá un equipo existente o los datos de uno nuevo',
    path: ['equipoId']
  });

export const actualizarOrdenSchema = datosOrdenSchema.partial();

export const listarOrdenesQuery = z.object({
  estado: z.enum(ESTADOS_ORDEN).optional()
});

export const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_ORDEN),
  comentario: z.string().trim().max(255).optional().nullable(),
  /**
   * Solo admin: saltea la validación de transiciones cuando la realidad del
   * taller no entra en el diagrama. Exige comentario para dejar el motivo.
   */
  forzar: z.boolean().optional()
});

export const presupuestoSchema = z.object({
  monto: monto.optional().nullable(),
  aprobado: z.boolean().optional().nullable()
});

/**
 * Entrega del equipo: el momento en que se cobra. `montoTotal` puede diferir
 * del presupuesto (un repuesto extra, un descuento), así que se confirma acá.
 */
export const entregaSchema = z
  .object({
    montoTotal: monto,
    montoAbonado: monto,
    medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
    comentario: z.string().trim().max(255).optional().nullable(),
    /** Solo admin: entregar desde un estado fuera del circuito. */
    forzar: z.boolean().optional()
  })
  .refine((d) => d.montoAbonado <= d.montoTotal, {
    message: 'Lo abonado no puede superar el total de la orden',
    path: ['montoAbonado']
  });

/** Pedido de autorización para entregar dejando deuda en un cliente sin cuenta corriente. */
export const solicitarFiadoSchema = z
  .object({
    montoTotal: monto,
    montoAbonado: monto,
    medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
    motivo: z.string().trim().min(1, 'Hay que explicar el motivo del pedido').max(500)
  })
  .refine((d) => d.montoAbonado <= d.montoTotal, {
    message: 'Lo abonado no puede superar el total de la orden',
    path: ['montoAbonado']
  });

/** PNG en base64, con o sin el prefijo `data:image/png;base64,`. Tope ~1 MB. */
export const firmaSchema = z.object({
  firmaBase64: z.string().min(50).max(1_500_000)
});
