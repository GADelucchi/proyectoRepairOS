import { z } from 'zod';
import { booleanoEnQuery, fechaIso } from '../../shared/validation/campos';

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
