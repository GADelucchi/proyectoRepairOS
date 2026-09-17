import { z } from 'zod';
import { ESTADOS_ORDEN } from '../models/Orden';
import { MEDIOS_PAGO } from '../models/CuentaMovimiento';
import { clienteBaseSchema } from './clienteValidators';

// El alta rápida de cliente dentro de una orden usa exactamente los mismos campos
// y las mismas reglas que el alta desde la pantalla de Clientes.
const nuevoClienteSchema = clienteBaseSchema;

const nuevoEquipoSchema = z.object({
  tipoEquipoPersonalizadoId: z.number().int().positive(),
  marca: z.string().optional().nullable(),
  modelo: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  numeroSerie: z.string().trim().optional(),
  claveDesbloqueo: z.string().optional().nullable(),
  cuentaUsuario: z.string().optional().nullable(),
  cuentaPassword: z.string().optional().nullable()
});

const chequeoSchema = z.object({
  item: z.string().trim().min(1),
  // La etiqueta elegida entre las opciones del chequeo, no un valor fijo.
  resultado: z.string().trim().max(80).optional().nullable(),
  opciones: z
    .array(z.object({ etiqueta: z.string().trim().min(1).max(80) }))
    .min(1)
    .optional(),
  orden: z.number().int().optional()
});

export const crearOrdenSchema = z
  .object({
    clienteId: z.number().int().positive().optional(),
    nuevoCliente: nuevoClienteSchema.optional(),
    equipoId: z.number().int().positive().optional(),
    nuevoEquipo: nuevoEquipoSchema.optional(),
    detallesEsteticos: z.string().optional().nullable(),
    reparacionSolicitada: z.string().min(1),
    notasInternas: z.string().optional().nullable(),
    fechaPactada: z.string().optional().nullable(),
    presupuestoMonto: z.number().nonnegative().optional().nullable(),
    chequeos: z.array(chequeoSchema).optional().default([])
  })
  .refine((data) => data.clienteId || data.nuevoCliente, {
    message: 'Debe indicar un cliente existente o los datos de un cliente nuevo',
    path: ['clienteId']
  })
  .refine((data) => data.equipoId || data.nuevoEquipo, {
    message: 'Debe indicar un equipo existente o los datos de un equipo nuevo',
    path: ['equipoId']
  });

export const actualizarOrdenSchema = z.object({
  detallesEsteticos: z.string().optional().nullable(),
  reparacionSolicitada: z.string().min(1).optional(),
  notasInternas: z.string().optional().nullable(),
  fechaPactada: z.string().optional().nullable(),
  presupuestoMonto: z.number().nonnegative().optional().nullable()
});

export const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_ORDEN as [string, ...string[]]),
  comentario: z.string().trim().max(255).optional().nullable(),
  /**
   * Solo para admin: saltea la validación de transiciones cuando la realidad del
   * taller no entra en el diagrama. Exige comentario para que quede el motivo.
   */
  forzar: z.boolean().optional()
});

export const presupuestoSchema = z.object({
  monto: z.number().nonnegative().optional().nullable(),
  aprobado: z.boolean().optional().nullable()
});

/**
 * Entrega del equipo: el momento en que se cobra.
 *
 * `montoTotal` puede diferir del presupuesto (un repuesto extra, un descuento),
 * así que se confirma acá en vez de darlo por sentado. Lo que no se abone queda
 * en la cuenta corriente del cliente.
 */
export const entregaSchema = z
  .object({
    montoTotal: z.number().nonnegative('El total no puede ser negativo'),
    montoAbonado: z.number().nonnegative('El monto abonado no puede ser negativo'),
    medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
    comentario: z.string().trim().max(255).optional().nullable(),
    /** Solo para admin: entregar desde un estado fuera del circuito. */
    forzar: z.boolean().optional()
  })
  .refine((data) => data.montoAbonado <= data.montoTotal, {
    message: 'Lo abonado no puede superar el total de la orden',
    path: ['montoAbonado']
  });

export const chequeosSchema = z.array(chequeoSchema);

export const firmaSchema = z.object({
  firmaBase64: z.string().min(50)
});
