import { Request, Response } from 'express';
import { paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { revisarVencimientosSiToca } from '../ventas/vencimientos.service';
import * as notificaciones from './notificaciones.service';

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await notificaciones.listarNotificaciones(usuarioDe(req).userId));
}

/**
 * Alimenta el número de la campanita, que se consulta cada minuto. De paso
 * vence las reservas y avisa las señas viejas: es lo que lo hace sin un proceso aparte.
 */
export async function contarNoLeidas(req: Request, res: Response): Promise<void> {
  await revisarVencimientosSiToca(tallerIdDe(req));
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
