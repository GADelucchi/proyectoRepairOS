import { z } from 'zod';
import { CONDICIONES_IVA_EMISOR } from '../../shared/utils/fiscal';
import { CODIGOS_PAIS } from '../../shared/utils/paises';
import { cuitOpcional, fechaIsoOpcional, textoOpcional } from '../../shared/validation/campos';

const nombreTipo = z.string().trim().min(1, 'El nombre es requerido').max(255);

export const crearTipoSchema = z.object({ nombre: nombreTipo });
export const actualizarTipoSchema = z.object({ nombre: nombreTipo.optional() });

export const opcionChequeoSchema = z.object({
  etiqueta: z.string().trim().min(1, 'Todas las opciones deben tener una etiqueta').max(80)
});

export const guardarChequeosSchema = z.object({
  chequeos: z.array(
    z.object({
      texto: z.string().trim().min(1, 'El texto del chequeo es requerido'),
      opciones: z
        .array(opcionChequeoSchema)
        .min(1, 'Cada chequeo necesita al menos una opción de respuesta')
        .optional()
    })
  )
});

/** Datos del taller que edita su admin. El país define la moneda por defecto y el prefijo de WhatsApp. */
export const actualizarTallerSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del taller es requerido').max(150).optional(),
  pais: z.enum(CODIGOS_PAIS).optional(),
  /** Cada sucursal ve el stock de las demás. */
  stockEntreSucursales: z.boolean().optional(),
  /** Publica los equipos disponibles y su precio en `/api/catalogo/:codigo`. */
  catalogoPublico: z.boolean().optional(),
  /** Se imprimen en el comprobante de cada venta de equipos. */
  terminosVenta: textoOpcional(10000),
  /** Van juntos: los campos vacíos se borran, así que guardar el nombre no los toca. */
  fiscal: z
    .object({
      razonSocial: textoOpcional(150),
      cuit: cuitOpcional,
      condicionIva: z.enum(CONDICIONES_IVA_EMISOR).optional().nullable(),
      domicilioFiscal: textoOpcional(255),
      inicioActividades: fechaIsoOpcional,
      ingresosBrutos: textoOpcional(30),
      // El rango que acepta ARCA en `PtoVta`.
      puntoVenta: z.number().int().min(1).max(99998).optional().nullable()
    })
    .optional()
});
