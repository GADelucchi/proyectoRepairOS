import { Request, Response } from 'express';
import { z } from 'zod';
import { CONDICIONES_EQUIPO } from '../../models/EquipoStock';
import { catalogoNoEncontrado, catalogoPublico } from './catalogo.service';

const codigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,12}$/);

const filtrosSchema = z.object({
  condicion: z.enum(CONDICIONES_EQUIPO).optional(),
  marca: z.string().trim().min(1).max(100).optional()
});

/** Los equipos en venta de un taller, con su precio (ver `catalogoPublico`). */
export async function consultar(req: Request, res: Response): Promise<void> {
  const codigo = codigoSchema.safeParse(req.params.codigo);
  if (!codigo.success) throw catalogoNoEncontrado();
  const filtros = filtrosSchema.parse(req.query);

  // Un minuto de caché alcanza: un equipo recién vendido deja de verse enseguida.
  res.set('Cache-Control', 'public, max-age=60');
  res.json(await catalogoPublico(codigo.data, filtros));
}
