import { z } from 'zod';
import { busqueda, fechaIsoOpcional, idPositivo } from '../../shared/validation/campos';

export const listarQuery = z.object({ search: busqueda });

/**
 * Cambio de suscripción desde la consola.
 *
 * - `prueba`: extiende (o acorta) la prueba hasta `hasta`, que es obligatoria.
 * - `activa`: plan pago vigente hasta `hasta`; sin fecha, no vence.
 * - `cancelada`: bloquea el acceso de todo el taller.
 */
export const actualizarSuscripcionSchema = z
  .object({
    estado: z.enum(['prueba', 'activa', 'cancelada']),
    planId: idPositivo.nullable().optional(),
    hasta: fechaIsoOpcional
  })
  .refine((d) => d.estado !== 'prueba' || d.hasta, {
    message: 'Indicá hasta qué día dura la prueba',
    path: ['hasta']
  });
