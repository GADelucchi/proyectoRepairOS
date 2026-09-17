import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import { Cliente, Orden, Solicitud, User } from '../models';
import { DatosFiado, EstadoSolicitud } from '../models/Solicitud';
import { tallerIdDe } from '../utils/tenant';
import { aprobarAjuste, cerrarSolicitud } from '../services/solicitudes';
import { ejecutarEntrega } from '../services/entregaOrden';
import { saldoDeCliente } from '../services/cuentaCorriente';
import { resolverSolicitudSchema } from '../validators/solicitudValidators';

const INCLUDES = [
  { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido', 'cuentaCorrienteHabilitada'] },
  { model: Orden, as: 'orden', attributes: ['id', 'numeroOrden', 'estado'] },
  { model: User, as: 'solicitante', attributes: ['id', 'nombre', 'apellido'] },
  { model: User, as: 'resueltoPor', attributes: ['id', 'nombre', 'apellido'] }
];

const ESTADOS: EstadoSolicitud[] = ['pendiente', 'aprobada', 'rechazada', 'cancelada'];

/** Busca una solicitud del taller o corta con 404. */
async function solicitudDelTaller(req: Request): Promise<Solicitud> {
  const solicitud = await Solicitud.findOne({
    where: { id: paramId(req), tallerId: tallerIdDe(req) },
    include: INCLUDES
  });
  if (!solicitud) throw new HttpError(404, 'Solicitud no encontrada');
  return solicitud;
}

/**
 * Autorizaciones del taller.
 *
 * Todos ven la lista —quien pidió necesita saber si le aprobaron— y solo un
 * admin puede resolverlas.
 */
export const listarSolicitudes = asyncHandler(async (req: Request, res: Response) => {
  const estado = req.query.estado as EstadoSolicitud | undefined;
  if (estado && !ESTADOS.includes(estado)) {
    throw new HttpError(400, 'Estado de solicitud desconocido');
  }

  const solicitudes = await Solicitud.findAll({
    where: { tallerId: tallerIdDe(req), ...(estado ? { estado } : {}) },
    include: INCLUDES,
    order: [['createdAt', 'DESC']],
    limit: 200
  });

  res.json(solicitudes);
});

/** Cuántas esperan resolución. Alimenta el aviso del menú. */
export const contarPendientes = asyncHandler(async (req: Request, res: Response) => {
  const pendientes = await Solicitud.count({
    where: { tallerId: tallerIdDe(req), estado: 'pendiente' }
  });
  res.json({ pendientes });
});

/**
 * Aprueba la solicitud y ejecuta lo que pedía.
 *
 * Aprobar sin ejecutar dejaría al mostrador esperando un segundo paso que nadie
 * le avisa que tiene que dar, así que el fiado entrega el equipo y el ajuste
 * asienta el movimiento acá mismo.
 */
export const aprobarSolicitud = asyncHandler(async (req: Request, res: Response) => {
  const solicitud = await solicitudDelTaller(req);
  const { respuesta } = resolverSolicitudSchema.parse(req.body);
  const aprobador = req.auth!;

  if (solicitud.estado !== 'pendiente') {
    throw new HttpError(409, `La solicitud ya está ${solicitud.estado}`);
  }

  if (solicitud.tipo === 'ajuste') {
    const saldo = await aprobarAjuste(solicitud, aprobador.userId, respuesta);
    res.json({ solicitud: await solicitudDelTaller(req), saldoCliente: saldo });
    return;
  }

  // Fiado: se entrega el equipo en nombre de quien lo pidió, que es quien lo
  // tiene en el mostrador y quien recibe la plata.
  const datos = solicitud.datos as DatosFiado | null;
  if (!datos) throw new HttpError(500, 'La solicitud de fiado no tiene datos de entrega');
  if (!solicitud.ordenId) throw new HttpError(500, 'La solicitud de fiado no apunta a ninguna orden');

  const orden = await Orden.findOne({
    where: { id: solicitud.ordenId },
    include: [{ model: Cliente, as: 'cliente' }]
  });
  if (!orden) throw new HttpError(404, 'La orden de la solicitud ya no existe');

  const cliente = (orden as any).cliente as Cliente;
  const quienAprueba = await User.findByPk(aprobador.userId, { attributes: ['nombre', 'apellido'] });

  await ejecutarEntrega({
    orden,
    cliente,
    tallerId: solicitud.tallerId,
    usuarioId: solicitud.solicitanteId,
    sucursalId: solicitud.sucursalId ?? orden.sucursalId,
    montoTotal: datos.montoTotal,
    montoAbonado: datos.montoAbonado,
    medioPago: datos.medioPago,
    puedeForzar: false,
    autorizadoPor: {
      usuarioId: aprobador.userId,
      nombre: quienAprueba ? `${quienAprueba.nombre} ${quienAprueba.apellido}` : 'un administrador'
    }
  });

  await cerrarSolicitud(solicitud, 'aprobada', aprobador.userId, respuesta);

  res.json({
    solicitud: await solicitudDelTaller(req),
    saldoCliente: await saldoDeCliente(solicitud.tallerId, solicitud.clienteId)
  });
});

export const rechazarSolicitud = asyncHandler(async (req: Request, res: Response) => {
  const solicitud = await solicitudDelTaller(req);
  const { respuesta } = resolverSolicitudSchema.parse(req.body);

  if (solicitud.estado !== 'pendiente') {
    throw new HttpError(409, `La solicitud ya está ${solicitud.estado}`);
  }

  await cerrarSolicitud(solicitud, 'rechazada', req.auth!.userId, respuesta);
  res.json(await solicitudDelTaller(req));
});

/**
 * Da de baja un pedido propio.
 *
 * Sirve cuando la situación cambió antes de que alguien la mirara: el cliente
 * terminó pagando, o el monto ya no es el que se pidió.
 */
export const cancelarSolicitud = asyncHandler(async (req: Request, res: Response) => {
  const solicitud = await solicitudDelTaller(req);
  const usuario = req.auth!;

  if (solicitud.estado !== 'pendiente') {
    throw new HttpError(409, `La solicitud ya está ${solicitud.estado}`);
  }
  if (solicitud.solicitanteId !== usuario.userId && usuario.rol !== 'admin') {
    throw new HttpError(403, 'Solo quien hizo el pedido o un administrador puede cancelarlo');
  }

  await cerrarSolicitud(solicitud, 'cancelada', usuario.userId);
  res.json(await solicitudDelTaller(req));
});
