import { Request, Response } from 'express';
import { Notificacion } from '../../models';
import { paramId, usuarioDe } from '../../shared/http/request-context';

const LIMITE_LISTADO = 30;

/** Los avisos más recientes del usuario, leídos y no leídos. */
export async function listar(req: Request, res: Response): Promise<void> {
  const notificaciones = await Notificacion.findAll({
    where: { usuarioId: usuarioDe(req).userId },
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ],
    limit: LIMITE_LISTADO
  });
  res.json(notificaciones);
}

/** Alimenta el número de la campanita, que se consulta cada minuto. */
export async function contarNoLeidas(req: Request, res: Response): Promise<void> {
  const noLeidas = await Notificacion.count({ where: { usuarioId: usuarioDe(req).userId, leidaEn: null } });
  res.json({ noLeidas });
}

/** Marcar un aviso ajeno no hace nada: el filtro por usuario lo deja afuera. */
export async function marcarLeida(req: Request, res: Response): Promise<void> {
  await Notificacion.update(
    { leidaEn: new Date() },
    { where: { id: paramId(req), usuarioId: usuarioDe(req).userId, leidaEn: null } }
  );
  res.status(204).send();
}

export async function marcarTodasLeidas(req: Request, res: Response): Promise<void> {
  await Notificacion.update(
    { leidaEn: new Date() },
    { where: { usuarioId: usuarioDe(req).userId, leidaEn: null } }
  );
  res.status(204).send();
}
