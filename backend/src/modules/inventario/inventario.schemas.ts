import { z } from 'zod';
import { TIPOS_ARTICULO } from '../../models/Articulo';
import { ESTADOS_PASE } from '../../models/Pase';
import {
  booleanoEnQuery,
  busqueda,
  fechaIsoOpcional,
  idEnQuery,
  idPositivo,
  moneda,
  monto,
  textoOpcional
} from '../../shared/validation/campos';

/** 1 US$ en la moneda que no es dólar. */
const cotizacion = z.number().positive('La cotización tiene que ser mayor a cero').max(99_999_999);

const cantidad = z
  .number()
  .int('La cantidad es un número entero')
  .positive('La cantidad tiene que ser mayor a cero')
  .max(100_000);

/** Un precio del producto: vacío si esa posición no tiene precio. */
const precio = z.object({ monto, moneda }).nullable();

const nombre = z.string().trim().min(1, 'Poné el nombre').max(150);

export const configInventarioSchema = z.object({
  precios: z
    .array(textoOpcional(30))
    .max(3, 'Hasta 3 precios')
    .refine((p) => p.some(Boolean), { message: 'Dejá al menos un precio' }),
  stockMinimoPorDefecto: z.number().int().min(0).max(100_000),
  avisoApp: z.boolean(),
  avisoEmail: z.boolean(),
  prefijos: z.object({
    repuesto: z.string().trim().max(10),
    accesorio: z.string().trim().max(10),
    servicio: z.string().trim().max(10)
  })
});
export type ConfigInventarioInput = z.infer<typeof configInventarioSchema>;

export const categoriaSchema = z.object({
  grupo: z.enum(TIPOS_ARTICULO),
  nombre: z.string().trim().min(1, 'Poné el nombre').max(100)
});
export const renombrarCategoriaSchema = categoriaSchema.pick({ nombre: true });

/** Lo que entra de un producto: cuántos, lo que costó cada uno y la cotización si no es en dólares. */
const datosCompra = {
  moneda,
  cotizacion: cotizacion.optional().nullable(),
  /** YYYY-MM-DD. Sin indicar, hoy. */
  fecha: fechaIsoOpcional,
  proveedor: textoOpcional(150),
  nota: textoOpcional(255)
};

const conCotizacion = (d: { moneda: string; cotizacion?: number | null }) =>
  d.moneda === 'USD' || !!d.cotizacion;
const MENSAJE_COTIZACION = {
  message: 'Indicá cuánto vale el dólar: el costo se informa en US$',
  path: ['cotizacion']
};

const primeraEntrada = z
  .object({ ...datosCompra, cantidad, costo: monto })
  .refine(conCotizacion, MENSAJE_COTIZACION);

const repuestoDeServicio = z.object({ repuestoId: idPositivo, cantidad });

const datosArticulo = {
  categoriaId: idPositivo.optional().nullable(),
  nombre,
  /** Sin indicar, se genera con el prefijo del tipo. */
  codigo: textoOpcional(30),
  codigoBarras: textoOpcional(64),
  stockMinimo: z.number().int().min(0).max(100_000).optional(),
  precios: z.array(precio).max(3).optional().default([]),
  /** Solo para un servicio: los repuestos que lleva. */
  repuestos: z.array(repuestoDeServicio).max(30).optional()
};

const sinRepuestosRepetidos = (d: { repuestos?: { repuestoId: number }[] }) =>
  !d.repuestos || new Set(d.repuestos.map((r) => r.repuestoId)).size === d.repuestos.length;

export const crearArticuloSchema = z
  .object({ tipo: z.enum(TIPOS_ARTICULO), ...datosArticulo, entrada: primeraEntrada.optional().nullable() })
  .refine(sinRepuestosRepetidos, { message: 'El mismo repuesto está dos veces', path: ['repuestos'] });
export type CrearArticuloInput = z.infer<typeof crearArticuloSchema>;

export const actualizarArticuloSchema = z
  .object(datosArticulo)
  .refine(sinRepuestosRepetidos, { message: 'El mismo repuesto está dos veces', path: ['repuestos'] });
export type ActualizarArticuloInput = z.infer<typeof actualizarArticuloSchema>;

export const archivarSchema = z.object({ activo: z.boolean() });

export const listarArticulosQuery = z.object({
  /** `productos` = repuestos y accesorios. */
  tipo: z.enum([...TIPOS_ARTICULO, 'productos']).optional(),
  categoriaId: idEnQuery.optional(),
  /** Nombre, código o código de barras. */
  search: busqueda,
  /** Sin indicar, la sucursal elegida. */
  sucursal: z.union([z.literal('todas'), idEnQuery]).optional(),
  bajoMinimo: booleanoEnQuery,
  archivados: booleanoEnQuery
});

export const detalleArticuloQuery = z.object({
  sucursal: idEnQuery.optional()
});

/** Una compra: una línea por producto, todas con el mismo proveedor, moneda y fecha. */
export const nuevaEntradaSchema = z
  .object({
    ...datosCompra,
    lineas: z
      .array(z.object({ articuloId: idPositivo, cantidad, costo: monto }))
      .min(1, 'Agregá al menos un producto')
      .max(100)
  })
  .refine(conCotizacion, MENSAJE_COTIZACION);
export type NuevaEntradaInput = z.infer<typeof nuevaEntradaSchema>;

export const bajaEntradaSchema = z.object({
  cantidad,
  motivo: z.string().trim().min(3, 'Contá por qué se dan de baja').max(255)
});

/**
 * Ajuste por conteo (solo admin): cuántos hay en la sucursal según lo que se
 * contó. Si aparecieron unidades, entran con este costo (sin indicar, el de la
 * última compra del producto).
 */
export const ajusteSchema = z.object({
  cantidadContada: z.number().int('La cantidad es un número entero').min(0).max(1_000_000),
  motivo: z.string().trim().min(3, 'Contá por qué se ajusta').max(255),
  costo: z
    .object({ moneda, monto, cotizacion: cotizacion.optional().nullable() })
    .refine(conCotizacion, MENSAJE_COTIZACION)
    .optional()
    .nullable()
});
export type AjusteInput = z.infer<typeof ajusteSchema>;

export const cotizacionQuery = z.object({ moneda });

/** Lo que va en un pase: unidades de un producto (salen de la entrada más vieja) o un equipo del stock. */
const itemPase = z.union([
  z.object({ articuloId: idPositivo, cantidad }),
  z.object({ equipoStockId: idPositivo })
]);

export const nuevoPaseSchema = z.object({
  sucursalDestinoId: idPositivo,
  nota: textoOpcional(255),
  items: z.array(itemPase).min(1, 'Agregá lo que se manda').max(100)
});
export type NuevoPaseInput = z.infer<typeof nuevoPaseSchema>;

export const listarPasesQuery = z.object({
  estado: z.enum(ESTADOS_PASE).optional()
});

/** Agregar a una orden un servicio (con sus repuestos) o un repuesto suelto. */
export const agregarAOrdenSchema = z
  .object({
    servicioId: idPositivo.optional(),
    articuloId: idPositivo.optional(),
    cantidad: cantidad.optional().default(1),
    /** La entrada de la que se quiere sacar (solo para un repuesto suelto). */
    entradaId: idPositivo.optional().nullable()
  })
  .refine((d) => Boolean(d.servicioId) !== Boolean(d.articuloId), {
    message: 'Elegí un servicio o un repuesto'
  });
export type AgregarAOrdenInput = z.infer<typeof agregarAOrdenSchema>;

export const perdidoSchema = z.object({ motivo: textoOpcional(255) });
export const cambiarEntradaSchema = z.object({ entradaId: idPositivo });

/** Al cancelar una orden o dejarla sin reparar: qué pasa con cada repuesto que tenía. */
export const destinoRepuestosSchema = z
  .array(
    z.object({
      consumoId: idPositivo,
      destino: z.enum(['stock', 'perdido']),
      motivo: textoOpcional(255)
    })
  )
  .max(100);
export type DestinoRepuestos = z.infer<typeof destinoRepuestosSchema>;

/** Usar repuestos del inventario en un equipo del stock: suman a su costo. */
export const repuestoEnEquipoSchema = z.object({
  articuloId: idPositivo,
  cantidad: cantidad.optional().default(1),
  entradaId: idPositivo.optional().nullable()
});

/** Lo que cobró el taller externo. */
export const costoExternoSchema = z
  .object({ moneda, monto, cotizacion: cotizacion.optional().nullable() })
  .refine(conCotizacion, MENSAJE_COTIZACION);

export const cotizacionOrdenSchema = z.object({ cotizacion });
