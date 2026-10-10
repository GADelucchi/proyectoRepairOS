import { Request, Response } from 'express';
import { z } from 'zod';
import { errores } from '../../shared/http/http-error';
import { seguimientoPublico } from './seguimiento.service';

const codigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,20}$/, 'Código inválido');

/** Lo que ve el cliente con el link de seguimiento (ver `seguimientoPublico`). */
export async function consultar(req: Request, res: Response): Promise<void> {
  const parsed = codigoSchema.safeParse(req.params.codigo);
  if (!parsed.success) throw errores.noEncontrado('Orden');

  const seguimiento = await seguimientoPublico(parsed.data);
  res.set('Cache-Control', 'no-store');
  res.json(seguimiento);
}
