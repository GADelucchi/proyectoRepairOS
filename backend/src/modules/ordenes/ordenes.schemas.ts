import { z } from 'zod';
import { ESTADOS_ORDEN } from '../../models/Orden';
import { MEDIOS_PAGO } from '../../models/CuentaMovimiento';
import {
  busqueda,
  emailOpcional,
  fechaIsoOpcional,
  idEnQuery,
  idPositivo,
  moneda,
  monto,
  montoPositivo,
  textoOpcional
} from '../../shared/validation/campos';
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

/** Precios alternativos al de lista: "en pesos y en efectivo, tanto". */
const preciosAlternativos = z
  .array(
    z.object({
      medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
      moneda,
      monto: montoPositivo
    })
  )
  .max(5, 'Se pueden cargar hasta 5 precios alternativos');

/** Qué incluye el presupuesto, para el cliente: lo ve en el seguimiento y en el remito. */
const detallePresupuesto = textoOpcional(2000);

export const chequeosSchema = z.array(chequeoSchema);
export type ChequeoInput = z.infer<typeof chequeoSchema>;

const datosOrdenSchema = z.object({
  detallesEsteticos: z.string().optional().nullable(),
  reparacionSolicitada: z.string().trim().min(1, 'Indicá la reparación o revisión a realizar'),
  notasInternas: z.string().optional().nullable(),
  fechaPactada: fechaIsoOpcional,
  presupuestoMonto: monto.optional().nullable(),
  presupuestoDetalle: detallePresupuesto
});

/**
 * Alta de una orden. El cliente y el equipo pueden ser existentes (por id) o
 * nuevos (con sus datos), y en ese caso se crean en la misma transacción.
 */
export const crearOrdenSchema = datosOrdenSchema
  .extend({
    /** Moneda del presupuesto de lista. Sin indicar, la local. */
    moneda: moneda.optional(),
    preciosAlternativos: preciosAlternativos.optional(),
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
  estado: z.enum(ESTADOS_ORDEN).optional(),
  /** Número de orden, serie, modelo o color del equipo, o nombre, teléfono o DNI del cliente. */
  search: busqueda,
  equipoId: idEnQuery.optional()
});

/** Nota para el equipo del taller: queda en el historial pero no sale en el remito. */
const notaInterna = textoOpcional(2000);

export const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_ORDEN),
  comentario: z.string().trim().max(255).optional().nullable(),
  notaInterna,
  /**
   * Solo admin: saltea la validación de transiciones cuando la realidad del
   * taller no entra en el diagrama. Exige comentario para dejar el motivo.
   */
  forzar: z.boolean().optional()
});

export const presupuestoSchema = z.object({
  monto: monto.optional().nullable(),
  moneda: moneda.optional(),
  detalle: detallePresupuesto,
  /** Si viene, reemplaza la lista entera. */
  preciosAlternativos: preciosAlternativos.optional(),
  aprobado: z.boolean().optional().nullable()
});

/**
 * Entrega del equipo: el momento en que se cobra. `montoTotal` puede diferir
 * del presupuesto (un repuesto extra, un descuento), así que se confirma acá.
 * También la moneda: se puede presupuestar en dólares y terminar cobrando en pesos.
 */
export const entregaSchema = z
  .object({
    montoTotal: monto,
    montoAbonado: monto,
    moneda: moneda.optional(),
    medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
    comentario: z.string().trim().max(255).optional().nullable(),
    notaInterna,
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
    moneda: moneda.optional(),
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

/** DNI (7 u 8 dígitos) o CUIT (11), con o sin puntos y guiones. Se guarda solo con los dígitos. */
const dniCuitOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(/\D/g, '') : null))
  .refine((v) => v === null || [7, 8, 11].includes(v.length), {
    message: 'El DNI tiene 7 u 8 números y el CUIT 11'
  });

/**
 * Mandar el equipo a un taller externo. Con `tallerDestinoId` (el que devolvió
 * la búsqueda por DNI o CUIT) el destino es un taller de RepairOS y se le arma
 * la orden.
 */
export const tercerizarSchema = z.object({
  nombre: z.string().trim().min(1, 'Indicá a quién se manda el equipo').max(150),
  dniCuit: dniCuitOpcional,
  direccion: textoOpcional(255),
  telefono: textoOpcional(50),
  email: emailOpcional,
  trabajo: z.string().trim().min(1, 'Indicá qué tiene que hacer el taller externo').max(2000),
  notaInterna,
  tallerDestinoId: idPositivo.optional().nullable(),
  sucursalDestinoId: idPositivo.optional().nullable(),
  /** Pasarle al destino la clave de desbloqueo y las cuentas del equipo. */
  compartirClaves: z.boolean().optional()
});
export type TercerizarInput = z.infer<typeof tercerizarSchema>;

export const buscarDestinoQuery = z.object({
  dniCuit: z.string().trim().min(1).max(20)
});

/** "Recibí el equipo" en la orden que armó otro taller al tercerizar: con qué tipo de equipo lo carga. */
export const recibirTercerizadoSchema = z.object({
  tipoEquipoPersonalizadoId: idPositivo
});
