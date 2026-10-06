import { z } from 'zod';
import { ESTADOS_SOLICITUD } from '../../models/Solicitud';
import { monedaConDefecto, montoPositivo } from '../../shared/validation/campos';

/** El motivo es obligatorio: quien aprueba tiene que saber qué está aprobando. */
export const motivoSchema = z.string().trim().min(1, 'Hay que explicar el motivo del pedido').max(500);

export const solicitarAjusteSchema = z.object({
  monto: montoPositivo,
  moneda: monedaConDefecto,
  /** `debito` suma deuda al cliente; `credito` se la descuenta. */
  direccion: z.enum(['debito', 'credito']),
  motivo: motivoSchema
});

export const resolverSolicitudSchema = z.object({
  respuesta: z.string().trim().max(500).optional().nullable()
});

export const listarSolicitudesQuery = z.object({
  estado: z.enum(ESTADOS_SOLICITUD).optional()
});
