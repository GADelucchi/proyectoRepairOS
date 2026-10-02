import { Request, Response } from 'express';
import { Cliente, Orden, Solicitud, User } from '../../models';
import { errores } from '../../shared/http/http-error';
import { esAdmin, paramId, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { nombreCompleto } from '../../shared/utils/texto';
import { listarSolicitudesQuery, resolverSolicitudSchema } from './solicitudes.schemas';
import { aprobar, rechazarOCancelar } from './solicitudes.service';

const LIMITE_LISTADO = 200;

const INCLUDES = [
  { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido', 'cuentaCorrienteHabilitada'] },
  { model: Orden, as: 'orden', attributes: ['id', 'numeroOrden', 'estado'] },
  { model: User, as: 'solicitante', attributes: ['id', 'nombre', 'apellido'] },
  { model: User, as: 'resueltoPor', attributes: ['id', 'nombre', 'apellido'] }
];

async function solicitudDelTaller(req: Request, id = paramId(req)): Promise<Solicitud> {
  const solicitud = await Solicitud.findOne({ where: { id, tallerId: tallerIdDe(req) }, include: INCLUDES });
  if (!solicitud) throw errores.noEncontrado('Solicitud');
  return solicitud;
}

/** Todos ven la lista (quien pidió necesita saber si le aprobaron); solo un admin resuelve. */
export async function listarSolicitudes(req: Request, res: Response): Promise<void> {
  const { estado } = listarSolicitudesQuery.parse(req.query);
  const solicitudes = await Solicitud.findAll({
    where: { tallerId: tallerIdDe(req), ...(estado ? { estado } : {}) },
    include: INCLUDES,
    order: [['createdAt', 'DESC']],
    limit: LIMITE_LISTADO
  });
  res.json(solicitudes);
}

/** Cuántas esperan resolución. Alimenta el aviso del menú. */
export async function contarPendientes(req: Request, res: Response): Promise<void> {
  const pendientes = await Solicitud.count({ where: { tallerId: tallerIdDe(req), estado: 'pendiente' } });
  res.json({ pendientes });
}

export async function aprobarSolicitud(req: Request, res: Response): Promise<void> {
  const solicitud = await solicitudDelTaller(req);
  const { respuesta } = resolverSolicitudSchema.parse(req.body);

  const aprobador = await User.findByPk(usuarioDe(req).userId, { attributes: ['id', 'nombre', 'apellido'] });
  if (!aprobador) throw errores.noAutenticado();

  const saldoCliente = await aprobar(
    solicitud,
    { id: aprobador.id, nombre: nombreCompleto(aprobador) || 'un administrador' },
    respuesta
  );
  res.json({ solicitud: await solicitudDelTaller(req), saldoCliente });
}

export async function rechazarSolicitud(req: Request, res: Response): Promise<void> {
  const solicitud = await solicitudDelTaller(req);
  const { respuesta } = resolverSolicitudSchema.parse(req.body);
  await rechazarOCancelar(solicitud, 'rechazada', usuarioDe(req).userId, respuesta);
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
  await rechazarOCancelar(solicitud, 'cancelada', usuario.userId);
  res.json(await solicitudDelTaller(req));
}
