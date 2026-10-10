import { Request, Response } from 'express';
import { errores } from '../../shared/http/http-error';
import { esAdmin, paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { listarSolicitudesQuery, resolverSolicitudSchema } from './solicitudes.schemas';
import * as solicitudes from './solicitudes.service';

function solicitudDelTaller(req: Request) {
  return solicitudes.solicitudDelTaller(tallerIdDe(req), paramId(req));
}

/** Todos ven la lista (quien pidió necesita saber si le aprobaron); solo un admin resuelve. */
export async function listarSolicitudes(req: Request, res: Response): Promise<void> {
  const { estado } = listarSolicitudesQuery.parse(req.query);
  res.json(await solicitudes.listarSolicitudes(tallerIdDe(req), estado));
}

/** Cuántas esperan resolución. Alimenta el aviso del menú. */
export async function contarPendientes(req: Request, res: Response): Promise<void> {
  res.json({ pendientes: await solicitudes.contarPendientes(tallerIdDe(req)) });
}

export async function aprobarSolicitud(req: Request, res: Response): Promise<void> {
  const solicitud = await solicitudDelTaller(req);
  const { respuesta } = resolverSolicitudSchema.parse(req.body);
  const aprobador = await solicitudes.aprobadorDe(usuarioDe(req).userId);

  const saldoCliente = await solicitudes.aprobar(solicitud, aprobador, respuesta);
  res.json({ solicitud: await solicitudDelTaller(req), saldoCliente });
}

export async function rechazarSolicitud(req: Request, res: Response): Promise<void> {
  const solicitud = await solicitudDelTaller(req);
  const { respuesta } = resolverSolicitudSchema.parse(req.body);
  await solicitudes.rechazarOCancelar(solicitud, 'rechazada', usuarioDe(req).userId, respuesta);
  res.json(await solicitudDelTaller(req));
}

/**
 * Da de baja un pedido propio: sirve cuando la situación cambió antes de que
 * alguien lo mirara (el cliente terminó pagando, el monto ya no es el mismo).
 */
export async function cancelarSolicitud(req: Request, res: Response): Promise<void> {
  const solicitud = await solicitudDelTaller(req);
  const usuario = usuarioDe(req);
  if (solicitud.solicitanteId !== usuario.userId && !esAdmin(req)) {
    throw errores.sinPermiso('Solo quien hizo el pedido o un administrador puede cancelarlo');
  }
  await solicitudes.rechazarOCancelar(solicitud, 'cancelada', usuario.userId);
  res.json(await solicitudDelTaller(req));
}
