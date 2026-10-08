import { Request, Response } from 'express';
import { z } from 'zod';
import { consultarPortal } from './portal.service';

const consultaSchema = z.object({
  dni: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 6 && v.length <= 11, 'Ingresá el DNI o CUIT completo, solo números'),
  telefono: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Ingresá los últimos 4 dígitos de tu teléfono')
});

/** Va por POST para que el DNI no quede en la URL, el historial ni los logs. */
export async function consultar(req: Request, res: Response): Promise<void> {
  const { dni, telefono } = consultaSchema.parse(req.body);
  const codigo = String(req.params.codigo ?? '');
  res.set('Cache-Control', 'no-store');
  res.json(await consultarPortal(codigo, dni, telefono));
}
