import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import {
  sequelize,
  Orden,
  Cliente,
  Equipo,
  OrdenChequeo,
  OrdenImagen,
  OrdenHistorialEstado,
  Sucursal,
  User,
  TipoEquipoPersonalizado
} from '../models';
import { EstadoOrden } from '../models/Orden';
import { esTransicionValida, transicionesDesde } from '../models/estadoOrden';
import { OPCIONES_CHEQUEO_POR_DEFECTO } from '../models/OrdenChequeo';
import {
  crearOrdenSchema,
  actualizarOrdenSchema,
  cambiarEstadoSchema,
  entregaSchema,
  presupuestoSchema,
  chequeosSchema,
  firmaSchema
} from '../validators/ordenValidators';
import { solicitarFiadoSchema } from '../validators/solicitudValidators';
import { encryptNullable } from '../utils/encryption';
import { generarNumeroOrden } from '../utils/numeroOrden';
import { generarNumeroSerieUnico } from '../utils/numeroSerie';
import { tallerIdDe } from '../utils/tenant';
import { repartirEntrega, saldoDeCliente } from '../services/cuentaCorriente';
import { ejecutarEntrega } from '../services/entregaOrden';
import { cerrarSolicitud, crearSolicitudFiado } from '../services/solicitudes';
import { getStorageProvider } from '../services/storage';
import { etiquetaEstado, notificarCambioEstadoOrden } from '../services/notificationService';
import { generarOrdenPdf } from '../services/pdfService';
import { extensionPara } from '../middlewares/upload';

const INCLUDES_DETALLE = [
  { model: Cliente, as: 'cliente' },
  {
    model: Equipo,
    as: 'equipo',
    include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }]
  },
  { model: Sucursal, as: 'sucursal' },
  { model: User, as: 'tecnico', attributes: ['id', 'nombre', 'apellido'] },
  { model: OrdenChequeo, as: 'chequeos', separate: true, order: [['orden', 'ASC']] as any },
  { model: OrdenImagen, as: 'imagenes', separate: true, order: [['createdAt', 'ASC']] as any },
  {
    model: OrdenHistorialEstado,
    as: 'historialEstados',
    separate: true,
    order: [['createdAt', 'ASC']] as any,
    include: [{ model: User, as: 'usuario', attributes: ['id', 'nombre', 'apellido'] }]
  }
];

export const listarOrdenes = asyncHandler(async (req: Request, res: Response) => {
  const sucursalId = req.auth?.sucursalId;
  if (!sucursalId) throw new HttpError(409, 'Debes seleccionar una sucursal');

  const where: any = { sucursalId };
  if (req.query.estado) where.estado = req.query.estado;

  const ordenes = await Orden.findAll({
    where,
    include: [
      { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido', 'telefono'] },
      {
        model: Equipo,
        as: 'equipo',
        attributes: ['id', 'tipoEquipoPersonalizadoId', 'marca', 'modelo'],
        include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }]
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: 200
  });
  res.json(ordenes);
});

export const obtenerOrden = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({
    where: { id: paramId(req), sucursalId: req.auth?.sucursalId },
    include: INCLUDES_DETALLE
  });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  // Va el saldo del cliente para que la entrega pueda ofrecer aplicar la plata
  // a favor sin pedir otra vuelta al servidor.
  res.json({
    ...orden.get({ plain: true }),
    saldoCliente: await saldoDeCliente(tallerIdDe(req), orden.clienteId)
  });
});

export const crearOrden = asyncHandler(async (req: Request, res: Response) => {
  const sucursalId = req.auth?.sucursalId;
  if (!sucursalId || !req.auth) throw new HttpError(409, 'Debes seleccionar una sucursal');
  const tallerId = tallerIdDe(req);

  const data = crearOrdenSchema.parse(req.body);

  const orden = await sequelize.transaction(async (t) => {
    let clienteId = data.clienteId;
    if (!clienteId && data.nuevoCliente) {
      const nuevo = await Cliente.create({ ...data.nuevoCliente, tallerId }, { transaction: t });
      clienteId = nuevo.id;
    }
    if (!clienteId) throw new HttpError(400, 'Cliente inválido');

    const clienteExiste = await Cliente.findOne({ where: { id: clienteId, tallerId }, transaction: t });
    if (!clienteExiste) throw new HttpError(404, 'Cliente no encontrado');

    let equipoId = data.equipoId;
    if (!equipoId && data.nuevoEquipo) {
      const numeroSerie = data.nuevoEquipo.numeroSerie?.trim() || (await generarNumeroSerieUnico(tallerId));
      const nuevo = await Equipo.create(
        {
          tallerId,
          clienteId,
          tipoEquipoPersonalizadoId: data.nuevoEquipo.tipoEquipoPersonalizadoId,
          marca: data.nuevoEquipo.marca ?? null,
          modelo: data.nuevoEquipo.modelo ?? null,
          color: data.nuevoEquipo.color ?? null,
          numeroSerie,
          claveDesbloqueoEnc: encryptNullable(data.nuevoEquipo.claveDesbloqueo),
          cuentaUsuarioEnc: encryptNullable(data.nuevoEquipo.cuentaUsuario),
          cuentaPasswordEnc: encryptNullable(data.nuevoEquipo.cuentaPassword)
        },
        { transaction: t }
      );
      equipoId = nuevo.id;
    }
    if (!equipoId) throw new HttpError(400, 'Equipo inválido');

    const equipoExiste = await Equipo.findOne({ where: { id: equipoId, tallerId }, transaction: t });
    if (!equipoExiste) throw new HttpError(404, 'Equipo no encontrado');

    const numeroOrden = await generarNumeroOrden(t, tallerId);

    const nuevaOrden = await Orden.create(
      {
        numeroOrden,
        clienteId,
        equipoId,
        sucursalId,
        tecnicoId: req.auth!.userId,
        estado: 'recibido',
        detallesEsteticos: data.detallesEsteticos ?? null,
        reparacionSolicitada: data.reparacionSolicitada,
        notasInternas: data.notasInternas ?? null,
        fechaPactada: data.fechaPactada ?? null,
        presupuestoMonto: data.presupuestoMonto ?? null
      },
      { transaction: t }
    );

    if (data.chequeos.length > 0) {
      await OrdenChequeo.bulkCreate(
        data.chequeos.map((c, index) => ({
          ordenId: nuevaOrden.id,
          item: c.item,
          resultado: c.resultado ?? null,
          // Se congelan las opciones con las que se recibió el equipo.
          opciones: c.opciones ?? OPCIONES_CHEQUEO_POR_DEFECTO,
          orden: c.orden ?? index
        })),
        { transaction: t }
      );
    }

    await OrdenHistorialEstado.create(
      {
        ordenId: nuevaOrden.id,
        estadoAnterior: null,
        estadoNuevo: 'recibido',
        usuarioId: req.auth!.userId,
        comentario: 'Orden creada'
      },
      { transaction: t }
    );

    return nuevaOrden;
  });

  const completa = await Orden.findByPk(orden.id, { include: INCLUDES_DETALLE });
  res.status(201).json(completa);
});

export const actualizarOrden = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({ where: { id: paramId(req), sucursalId: req.auth?.sucursalId } });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const data = actualizarOrdenSchema.parse(req.body);
  await orden.update(data);
  res.json(orden);
});

export const cambiarEstadoOrden = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({
    where: { id: paramId(req), sucursalId: req.auth?.sucursalId },
    include: [{ model: Cliente, as: 'cliente' }]
  });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const { estado, comentario, forzar } = cambiarEstadoSchema.parse(req.body);
  const estadoAnterior = orden.estado;
  const nuevoEstado = estado as EstadoOrden;

  // La entrega mueve plata, así que tiene su propio endpoint: pasar por acá
  // dejaría el equipo entregado sin registrar cuánto se cobró.
  if (nuevoEstado === 'entregado') {
    throw new HttpError(409, 'Para entregar el equipo hay que registrar el cobro desde la entrega.');
  }

  if (nuevoEstado === estadoAnterior) {
    throw new HttpError(400, `La orden ya está en estado "${etiquetaEstado(estadoAnterior)}"`);
  }

  if (!esTransicionValida(estadoAnterior, nuevoEstado)) {
    // El admin puede salirse del circuito cuando la realidad del taller no entra
    // en el diagrama, pero tiene que dejar asentado por qué.
    const puedeForzar = forzar === true && req.auth?.rol === 'admin';
    if (!puedeForzar) {
      const posibles = transicionesDesde(estadoAnterior).map(etiquetaEstado);
      throw new HttpError(
        409,
        posibles.length > 0
          ? `No se puede pasar de "${etiquetaEstado(estadoAnterior)}" a "${etiquetaEstado(nuevoEstado)}". Estados posibles: ${posibles.join(', ')}.`
          : `La orden está en "${etiquetaEstado(estadoAnterior)}" y no admite más cambios de estado.`
      );
    }
    if (!comentario?.trim()) {
      throw new HttpError(
        400,
        'Para forzar un cambio de estado fuera del circuito hay que indicar el motivo'
      );
    }
  }

  const forzado = !esTransicionValida(estadoAnterior, nuevoEstado);

  await orden.update({ estado: nuevoEstado });
  await OrdenHistorialEstado.create({
    ordenId: orden.id,
    estadoAnterior,
    estadoNuevo: nuevoEstado,
    usuarioId: req.auth!.userId,
    comentario: forzado ? `[Forzado] ${comentario}` : (comentario ?? null)
  });

  // Se espera el aviso para poder contar qué pasó realmente. Si falla, la orden
  // ya cambió de estado igual: el error se informa, no se revierte el cambio.
  const cliente = (orden as any).cliente as Cliente;
  const notificacion = cliente ? await notificarCambioEstadoOrden(orden, cliente) : null;

  res.json({ ...orden.get({ plain: true }), notificacion });
});

/**
 * Entrega del equipo desde el mostrador.
 *
 * La lógica vive en `services/entregaOrden` porque la aprobación de un fiado
 * por parte de un supervisor entra por el mismo lugar y tiene que registrar
 * exactamente lo mismo.
 */
export const entregarOrden = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const sucursalId = req.auth?.sucursalId;
  if (!sucursalId) throw new HttpError(409, 'Debes seleccionar una sucursal');

  const { montoTotal, montoAbonado, medioPago, comentario, forzar } = entregaSchema.parse(req.body);

  const orden = await Orden.findOne({
    where: { id: paramId(req), sucursalId },
    include: [{ model: Cliente, as: 'cliente' }]
  });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const cliente = (orden as any).cliente as Cliente | undefined;
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');

  const { pendiente, creditoAplicado, notificacion } = await ejecutarEntrega({
    orden,
    cliente,
    tallerId,
    usuarioId: req.auth!.userId,
    sucursalId,
    montoTotal,
    montoAbonado,
    medioPago,
    comentario,
    forzar,
    puedeForzar: req.auth?.rol === 'admin'
  });

  res.json({
    ...orden.get({ plain: true }),
    notificacion,
    pendiente,
    creditoAplicado,
    saldoCliente: await saldoDeCliente(tallerId, cliente.id)
  });
});

/**
 * Pide autorización para entregar dejando saldo en un cliente sin cuenta corriente.
 *
 * Es la salida del mostrador cuando la entrega se rechaza: el cliente está en el
 * local esperando, y frenar sin alternativa obliga a resolverlo por teléfono y
 * sin dejar rastro de quién autorizó qué.
 *
 * Si quien pide ya es admin no tiene sentido hacerlo esperar su propia
 * aprobación: se ejecuta al instante, pero queda igual el registro de la
 * solicitud aprobada para que el fiado tenga siempre un responsable asentado.
 */
export const solicitarFiado = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const sucursalId = req.auth?.sucursalId;
  if (!sucursalId) throw new HttpError(409, 'Debes seleccionar una sucursal');

  const { montoTotal, montoAbonado, medioPago, motivo } = solicitarFiadoSchema.parse(req.body);
  if (montoAbonado > montoTotal) {
    throw new HttpError(400, 'Lo abonado no puede superar el total de la orden');
  }

  const orden = await Orden.findOne({
    where: { id: paramId(req), sucursalId },
    include: [{ model: Cliente, as: 'cliente' }]
  });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');
  if (orden.estado === 'entregado') throw new HttpError(409, 'La orden ya fue entregada');

  const cliente = (orden as any).cliente as Cliente | undefined;
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');

  // Con el saldo a favor descontado puede no quedar deuda, y entonces no hay
  // nada que autorizar: la entrega se hace derecho.
  const saldoPrevio = await saldoDeCliente(tallerId, cliente.id);
  const { pendiente } = repartirEntrega(saldoPrevio, montoTotal, montoAbonado);
  if (pendiente <= 0) {
    throw new HttpError(400, 'No hace falta autorización: la orden queda cubierta');
  }
  if (cliente.cuentaCorrienteHabilitada) {
    throw new HttpError(400, 'El cliente ya tiene cuenta corriente: la entrega se puede hacer directo');
  }

  const esAdmin = req.auth?.rol === 'admin';
  const solicitud = await crearSolicitudFiado({
    tallerId,
    solicitanteId: req.auth!.userId,
    esAdmin,
    sucursalId,
    cliente,
    ordenId: orden.id,
    pendiente,
    motivo,
    datos: { montoTotal, montoAbonado, medioPago: medioPago ?? null }
  });

  if (!esAdmin) {
    res.status(201).json({ solicitud, autorizada: false });
    return;
  }

  const { notificacion } = await ejecutarEntrega({
    orden,
    cliente,
    tallerId,
    usuarioId: req.auth!.userId,
    sucursalId,
    montoTotal,
    montoAbonado,
    medioPago,
    puedeForzar: false,
    autorizadoPor: { usuarioId: req.auth!.userId, nombre: 'un administrador' }
  });
  await cerrarSolicitud(solicitud, 'aprobada', req.auth!.userId, 'Autorizada por quien la pidió (admin)');

  res.status(201).json({
    solicitud,
    autorizada: true,
    notificacion,
    saldoCliente: await saldoDeCliente(tallerId, cliente.id)
  });
});

export const actualizarPresupuesto = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({
    where: { id: paramId(req), sucursalId: req.auth?.sucursalId },
    include: [{ model: Cliente, as: 'cliente' }]
  });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const { monto, aprobado } = presupuestoSchema.parse(req.body);
  const estadoAnterior = orden.estado;

  const updates: Record<string, unknown> = {};

  if (monto !== undefined) {
    updates.presupuestoMonto = monto;
    // Cargar el monto es, en la práctica, presupuestar: se avanza el estado si
    // el circuito lo permite, así el mostrador no tiene que hacerlo aparte.
    if (monto !== null && esTransicionValida(estadoAnterior, 'presupuestado')) {
      updates.estado = 'presupuestado';
    }
  }

  if (aprobado !== undefined && aprobado !== null) {
    const destino: EstadoOrden = aprobado ? 'aprobado' : 'rechazado';
    const estadoBase = (updates.estado as EstadoOrden | undefined) ?? estadoAnterior;

    if (!esTransicionValida(estadoBase, destino)) {
      throw new HttpError(
        409,
        `Para registrar la respuesta del cliente, la orden tiene que estar presupuestada (hoy está en "${etiquetaEstado(estadoBase)}").`
      );
    }

    updates.presupuestoAprobado = aprobado;
    updates.estado = destino;
  }

  await orden.update(updates);

  let notificacion = null;
  if (updates.estado && updates.estado !== estadoAnterior) {
    await OrdenHistorialEstado.create({
      ordenId: orden.id,
      estadoAnterior,
      estadoNuevo: orden.estado,
      usuarioId: req.auth!.userId,
      comentario: 'Actualización de presupuesto'
    });
    const cliente = (orden as any).cliente as Cliente;
    if (cliente) {
      notificacion = await notificarCambioEstadoOrden(orden, cliente);
    }
  }

  res.json({ ...orden.get({ plain: true }), notificacion });
});

export const reemplazarChequeos = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({ where: { id: paramId(req), sucursalId: req.auth?.sucursalId } });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const chequeos = chequeosSchema.parse(req.body);

  await sequelize.transaction(async (t) => {
    await OrdenChequeo.destroy({ where: { ordenId: orden.id }, transaction: t });
    if (chequeos.length > 0) {
      await OrdenChequeo.bulkCreate(
        chequeos.map((c, index) => ({
          ordenId: orden.id,
          item: c.item,
          resultado: c.resultado ?? null,
          opciones: c.opciones ?? OPCIONES_CHEQUEO_POR_DEFECTO,
          orden: c.orden ?? index
        })),
        { transaction: t }
      );
    }
  });

  const actualizados = await OrdenChequeo.findAll({
    where: { ordenId: orden.id },
    order: [['orden', 'ASC']]
  });
  res.json(actualizados);
});

export const subirImagenes = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({ where: { id: paramId(req), sucursalId: req.auth?.sucursalId } });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw new HttpError(400, 'No se recibieron imágenes');

  const storage = getStorageProvider();
  const imagenes = await Promise.all(
    files.map(async (file) => {
      // La extensión sale del mime que ya validó multer, nunca del nombre del
      // archivo: `originalname` puede traer barras y `..` y escaparse del
      // directorio de subidas al armar la ruta.
      const key = `ordenes/${orden.id}/${uuidv4()}.${extensionPara(file.mimetype)}`;
      const { url, storageKey } = await storage.upload(file.buffer, key, file.mimetype);
      return OrdenImagen.create({
        ordenId: orden.id,
        url,
        storageKey,
        descripcion: req.body.descripcion ?? null
      });
    })
  );

  res.status(201).json(imagenes);
});

export const eliminarImagen = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({ where: { id: paramId(req), sucursalId: req.auth?.sucursalId } });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const imagen = await OrdenImagen.findOne({ where: { id: paramId(req, 'imagenId'), ordenId: orden.id } });
  if (!imagen) throw new HttpError(404, 'Imagen no encontrada');

  await getStorageProvider().delete(imagen.storageKey);
  await imagen.destroy();
  res.status(204).send();
});

export const guardarFirma = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({ where: { id: paramId(req), sucursalId: req.auth?.sucursalId } });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const { firmaBase64 } = firmaSchema.parse(req.body);
  const matches = firmaBase64.match(/^data:image\/png;base64,(.+)$/);
  const base64Data = matches ? matches[1] : firmaBase64;
  const buffer = Buffer.from(base64Data, 'base64');

  const storage = getStorageProvider();
  const key = `ordenes/${orden.id}/firma-${uuidv4()}.png`;
  const { url } = await storage.upload(buffer, key, 'image/png');

  await orden.update({ firmaClienteUrl: url });
  res.json({ firmaClienteUrl: url });
});

export const descargarPdf = asyncHandler(async (req: Request, res: Response) => {
  const orden = await Orden.findOne({
    where: { id: paramId(req), sucursalId: req.auth?.sucursalId },
    include: [
      { model: Cliente, as: 'cliente' },
      {
        model: Equipo,
        as: 'equipo',
        include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }]
      },
      { model: Sucursal, as: 'sucursal' },
      { model: User, as: 'tecnico' },
      { model: OrdenChequeo, as: 'chequeos', separate: true, order: [['orden', 'ASC']] as any },
      {
        model: OrdenHistorialEstado,
        as: 'historialEstados',
        separate: true,
        order: [['createdAt', 'ASC']] as any,
        include: [{ model: User, as: 'usuario', attributes: ['id', 'nombre', 'apellido'] }]
      }
    ]
  });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const pdfBuffer = await generarOrdenPdf({
    orden,
    cliente: (orden as any).cliente,
    equipo: (orden as any).equipo,
    chequeos: (orden as any).chequeos ?? [],
    historial: (orden as any).historialEstados ?? [],
    sucursal: (orden as any).sucursal ?? null,
    tipoEquipoNombre: (orden as any).equipo?.tipoEquipo?.nombre ?? 'Sin especificar',
    tecnicoNombre: `${(orden as any).tecnico?.nombre ?? ''} ${(orden as any).tecnico?.apellido ?? ''}`.trim()
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${orden.numeroOrden}.pdf"`);
  res.send(pdfBuffer);
});
