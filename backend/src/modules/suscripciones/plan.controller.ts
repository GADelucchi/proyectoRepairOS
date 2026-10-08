import { Request, Response } from 'express';
import { z } from 'zod';
import { Sucursal, User } from '../../models';
import { tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { invalidarCacheCompleta } from '../../shared/middlewares/auth.middleware';
import { idPositivo } from '../../shared/validation/campos';
import { ajustarAlPlan, excesoDelPlan } from './limites.service';

const ajusteSchema = z.object({
  usuarios: z.array(idPositivo).optional(),
  sucursales: z.array(idPositivo).optional()
});

/**
 * El exceso del plan (si lo hay) con los usuarios y sucursales activos, para
 * que el admin elija cuáles quedan.
 */
export async function obtenerExceso(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const exceso = await excesoDelPlan(tallerId);
  if (!exceso) {
    res.json({ exceso: null });
    return;
  }
  const [usuarios, sucursales] = await Promise.all([
    User.findAll({
      where: { tallerId, activo: true },
      attributes: ['id', 'nombre', 'apellido', 'email', 'rol', 'ultimoAccesoAt'],
      order: [['nombre', 'ASC']]
    }),
    Sucursal.findAll({
      where: { tallerId, activo: true },
      attributes: ['id', 'nombre', 'direccion'],
      order: [['nombre', 'ASC']]
    })
  ]);
  res.json({ exceso, usuarios, sucursales });
}

export async function ajustar(req: Request, res: Response): Promise<void> {
  await ajustarAlPlan(tallerIdDe(req), usuarioDe(req).userId, ajusteSchema.parse(req.body));
  // Los usuarios dados de baja quedan afuera ya, no cuando venza su caché.
  invalidarCacheCompleta();
  res.status(204).send();
}
