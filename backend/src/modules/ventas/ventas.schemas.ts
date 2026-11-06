import { z } from 'zod';
import { MEDIOS_PAGO } from '../../models/CuentaMovimiento';
import { ESTADOS_VENTA, TIPOS_DESCUENTO } from '../../models/Venta';
import {
  booleanoEnQuery,
  busqueda,
  fechaIso,
  fechaIsoOpcional,
  idPositivo,
  moneda,
  monto,
  montoPositivo,
  textoOpcional
} from '../../shared/validation/campos';
import { clienteSchema } from '../clientes/clientes.schemas';
import {
  MENSAJE_SIN_IDENTIFICACION,
  conIdentificacion,
  datosDeEquipo,
  imeisDistintos
} from '../stock/stock.schemas';

/** Cómo se cierra la venta al crearla: se lleva el equipo, deja una seña, o lo aparta sin pagar. */
export const MODOS_VENTA = ['venta', 'sena', 'reserva'] as const;

const pagosSchema = z
  .array(
    z.object({
      monto: montoPositivo,
      medioPago: z.enum(MEDIOS_PAGO, { message: 'Elegí el medio de pago' })
    })
  )
  .max(5);

/** Un equipo que deja el cliente: entra al stock como usado, con lo que se le tomó como costo. */
const partePagoSchema = z
  .object({
    ...datosDeEquipo,
    condicion: datosDeEquipo.condicion.optional().default('usado'),
    monto: montoPositivo
  })
  .refine(conIdentificacion, { message: MENSAJE_SIN_IDENTIFICACION, path: ['imei'] })
  .refine(imeisDistintos, { message: 'Los dos IMEI son iguales', path: ['imei2'] })
  .transform((e) => ({ ...e, bateria: e.condicion === 'usado' ? (e.bateria ?? null) : null }));

export type PartePagoInput = z.infer<typeof partePagoSchema>;

export const crearVentaSchema = z
  .object({
    clienteId: idPositivo.optional(),
    nuevoCliente: clienteSchema.optional(),
    items: z
      .array(z.object({ equipoStockId: idPositivo, precio: monto }))
      .min(1, 'Agregá al menos un equipo')
      .max(20),
    moneda,
    /** 1 US$ en la moneda de la venta, ese día. */
    cotizacion: z.number().positive().max(99_999_999).optional().nullable(),
    descuento: z
      .object({ tipo: z.enum(TIPOS_DESCUENTO), valor: monto })
      .refine((d) => d.tipo !== 'porcentaje' || d.valor <= 100, {
        message: 'El descuento no puede pasar del 100 %'
      })
      .optional()
      .nullable(),
    partesPago: z.array(partePagoSchema).max(5).optional().default([]),
    modo: z.enum(MODOS_VENTA),
    pagos: pagosSchema.optional().default([]),
    reservadaHasta: fechaIsoOpcional,
    comentarioCliente: textoOpcional(2000),
    comentarioInterno: textoOpcional(2000)
  })
  .refine((v) => v.clienteId || v.nuevoCliente, {
    message: 'Elegí un cliente o cargá uno nuevo',
    path: ['clienteId']
  })
  .refine((v) => new Set(v.items.map((i) => i.equipoStockId)).size === v.items.length, {
    message: 'El mismo equipo está dos veces',
    path: ['items']
  })
  .refine((v) => v.moneda === 'USD' || v.cotizacion, {
    message: 'Indicá cuánto vale el dólar hoy: el informe de ventas se calcula en US$',
    path: ['cotizacion']
  })
  .refine((v) => v.modo !== 'reserva' || v.reservadaHasta, {
    message: 'Indicá hasta qué día se reserva',
    path: ['reservadaHasta']
  })
  .refine((v) => v.modo !== 'reserva' || v.pagos.length === 0, {
    message: 'Una reserva no lleva pago: si el cliente deja plata, es una seña',
    path: ['pagos']
  })
  .refine((v) => v.modo !== 'sena' || v.pagos.length > 0, {
    message: 'Indicá cuánto deja de seña',
    path: ['pagos']
  })
  .transform((v) => ({
    ...v,
    cotizacion: v.moneda === 'USD' ? null : (v.cotizacion ?? null),
    reservadaHasta: v.modo === 'reserva' ? v.reservadaHasta : null
  }));

export type NuevaVenta = z.infer<typeof crearVentaSchema>;

/** Pagar sobre una reserva o una seña. Si cubre el saldo, la venta se completa. */
export const pagarVentaSchema = z.object({ pagos: pagosSchema });

export const extenderReservaSchema = z.object({ hasta: fechaIso });

export const cancelarVentaSchema = z.object({
  motivo: z.string().trim().min(3, 'Contá por qué se cancela').max(255),
  /** Si se le devuelve la seña al cliente. Si no, el taller se la queda. */
  devolverSena: z.boolean().optional().default(false),
  medioDevolucion: z.enum(MEDIOS_PAGO).optional().default('efectivo')
});

export const listarVentasQuery = z.object({
  estado: z.enum(ESTADOS_VENTA).optional(),
  /** Número de venta, cliente (nombre o DNI), IMEI o serial de un equipo vendido. */
  search: busqueda,
  /** Solo tiene efecto para admin. */
  todasLasSucursales: booleanoEnQuery
});
