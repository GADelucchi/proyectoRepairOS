import { z } from 'zod';
import { CONDICIONES_EQUIPO, ESTADOS_STOCK } from '../../models/EquipoStock';
import {
  busqueda,
  fechaIso,
  idEnQuery,
  imeiOpcional,
  moneda,
  monto,
  textoOpcional
} from '../../shared/validation/campos';

/** Lo que describe a un equipo: lo comparten el stock y los que deja el cliente en parte de pago. */
export const datosDeEquipo = {
  marca: z.string().trim().min(1, 'Indicá la marca').max(100),
  modelo: z.string().trim().min(1, 'Indicá el modelo').max(100),
  color: textoOpcional(50),
  /** 1 TB = 1024. */
  almacenamientoGb: z.number().int().positive().max(65536).optional().nullable(),
  condicion: z.enum(CONDICIONES_EQUIPO, { message: 'Indicá si es nuevo o usado' }),
  bateria: z.number().int().min(0).max(100).optional().nullable(),
  numeroSerie: textoOpcional(150),
  imei: imeiOpcional,
  imei2: imeiOpcional,
  observaciones: textoOpcional(2000)
};

type Identificable = { numeroSerie: string | null; imei: string | null; imei2: string | null };

/** El serial o el IMEI es lo que distingue a una unidad de otra igual. */
export const conIdentificacion = <T extends Identificable>(e: T) => Boolean(e.numeroSerie || e.imei);
export const MENSAJE_SIN_IDENTIFICACION =
  'Cargá el número de serie o el IMEI: es lo que identifica al equipo';
export const imeisDistintos = <T extends Identificable>(e: T) => !e.imei || e.imei !== e.imei2;

/**
 * Una unidad del stock. El formulario manda todo junto, también al editar: así
 * las reglas que cruzan campos (la cotización, la batería) se validan siempre
 * sobre el equipo completo.
 */
export const equipoStockSchema = z
  .object({
    ...datosDeEquipo,
    fechaCompra: fechaIso,
    proveedor: textoOpcional(150),
    monedaCosto: moneda,
    costo: monto,
    /** 1 US$ en la moneda del costo, el día de compra. */
    cotizacionCosto: z.number().positive().max(99_999_999).optional().nullable(),
    monedaPrecio: moneda.optional().nullable(),
    precio: monto.optional().nullable()
  })
  .refine(conIdentificacion, { message: MENSAJE_SIN_IDENTIFICACION, path: ['imei'] })
  .refine((e) => e.monedaCosto === 'USD' || e.cotizacionCosto, {
    message: 'Indicá cuánto valía el dólar el día de compra: el informe se calcula en US$',
    path: ['cotizacionCosto']
  })
  .refine(imeisDistintos, { message: 'Los dos IMEI son iguales', path: ['imei2'] })
  // Un equipo nuevo no tiene batería que informar; en dólares no hace falta cotización.
  .transform((e) => ({
    ...e,
    bateria: e.condicion === 'usado' ? (e.bateria ?? null) : null,
    cotizacionCosto: e.monedaCosto === 'USD' ? null : (e.cotizacionCosto ?? null),
    monedaPrecio: e.precio != null ? (e.monedaPrecio ?? e.monedaCosto) : null,
    precio: e.precio ?? null
  }));

export type EquipoStockInput = z.infer<typeof equipoStockSchema>;

export const listarStockQuery = z.object({
  estado: z.enum(ESTADOS_STOCK).optional(),
  condicion: z.enum(CONDICIONES_EQUIPO).optional(),
  /** Número (#42), marca, modelo, color, serial o IMEI. */
  search: busqueda,
  /** Sin indicar, la sucursal elegida. `todas` u otra exigen tenerlo habilitado en el taller. */
  sucursal: z.union([z.literal('todas'), idEnQuery]).optional()
});

/** Dar de baja: el equipo sale del stock pero la fila queda, con el motivo. */
export const bajaStockSchema = z.object({
  motivo: z.string().trim().min(3, 'Contá por qué se da de baja').max(255)
});

/** ¿Este IMEI o serial ya está en el stock? Se pregunta mientras se carga el equipo. */
export const verificarStockQuery = z.object({
  imei: busqueda,
  numeroSerie: busqueda,
  /** El equipo que se está editando, que no cuenta como repetido. */
  excluirId: idEnQuery.optional()
});
