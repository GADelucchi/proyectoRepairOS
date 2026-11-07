import { z } from 'zod';
import { booleanoEnQuery, fechaIso } from '../../shared/validation/campos';
import { LISTADOS_DEL_PERIODO } from './estadisticas.service';

/** Rango de fechas de calendario. Sin parámetros, el informe es del día de hoy. */
export const rangoCajaQuery = z
  .object({
    desde: fechaIso.optional(),
    hasta: fechaIso.optional(),
    /** Solo tiene efecto para admin; el técnico ve siempre su sucursal. */
    todasLasSucursales: booleanoEnQuery
  })
  .refine((q) => !q.desde || !q.hasta || q.desde <= q.hasta, {
    message: 'La fecha de inicio no puede ser posterior a la de fin',
    path: ['desde']
  });

/** Cuáles órdenes del período listar: las que ingresaron o las que se entregaron. */
export const ordenesDelPeriodoQuery = z.object({ cuales: z.enum(LISTADOS_DEL_PERIODO) });
