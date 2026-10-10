import { Request, Response } from 'express';
import { paramId, usuarioDe } from '../../shared/http/request-context';
import * as notificaciones from './notificaciones.service';

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await notificaciones.listarNotificaciones(usuarioDe(req).userId));
}

/** Alimenta el número de la campanita, que se consulta cada minuto. */
export async function contarNoLeidas(req: Request, res: Response): Promise<void> {
  res.json({ noLeidas: await notificaciones.contarNoLeidas(usuarioDe(req).userId) });
}

export async function marcarLeida(req: Request, res: Response): Promise<void> {
  await notificaciones.marcarLeida(usuarioDe(req).userId, paramId(req));
  res.status(204).send();
}

export async function marcarTodasLeidas(req: Request, res: Response): Promise<void> {
  await notificaciones.marcarTodasLeidas(usuarioDe(req).userId);
  res.status(204).send();
}
