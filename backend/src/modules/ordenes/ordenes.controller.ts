import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { sequelize, Cliente, Orden, OrdenChequeo, OrdenImagen, User } from '../../models';
import { getStorageProvider } from '../../integrations/storage';
import { errores } from '../../shared/http/http-error';
import { esAdmin, paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { extensionPara } from '../../shared/middlewares/upload.middleware';
import { decryptBuffer, encryptBuffer } from '../../shared/security/encryption';
import { nombreCompleto } from '../../shared/utils/texto';
import { repartirEntrega, saldoDeCliente } from '../cuentas/cuenta-corriente.service';
import { notificarCambioEstadoOrden, ResultadoNotificacion } from '../notificaciones/notificaciones.service';
import { fiarComoAdmin, pedirFiado } from '../solicitudes/solicitudes.service';
import { ejecutarEntrega } from './entrega.service';
import { esTransicionValida, etiquetaEstado, transicionesDesde } from './estado-orden';
import { generarOrdenPdf } from './orden-pdf.service';
import {
  actualizarOrdenSchema,
  cambiarEstadoSchema,
  chequeosSchema,
  crearOrdenSchema,
  entregaSchema,
  firmaSchema,
  listarOrdenesQuery,
  presupuestoSchema,
  solicitarFiadoSchema
} from './ordenes.schemas';
import {
  INCLUDES_DETALLE,
  INCLUDES_LISTADO,
  buscarOrdenDeSucursal,
  crearOrden as crearOrdenConDatos,
  exigirEditable,
  filasDeChequeo,
  filtroDeOrdenes,
  registrarCambioDeEstado
} from './ordenes.service';

const LIMITE_LISTADO = 200;
const FIRMA_PNG = /^data:image\/png;base64,/;
const CABECERA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** La orden de la URL, dentro de la sucursal activa. */
const ordenDe = (req: Request, opciones?: Parameters<typeof buscarOrdenDeSucursal>[2]) =>
  buscarOrdenDeSucursal(paramId(req), sucursalIdDe(req), opciones);

const CON_CLIENTE = { include: [{ model: Cliente, as: 'cliente' }] };

/** Avisa al cliente si cambió el estado. El aviso nunca revierte el cambio. */
async function avisarSiCambio(orden: Orden, estadoAnterior: string): Promise<ResultadoNotificacion | null> {
  if (orden.estado === estadoAnterior || !orden.cliente) return null;
  return notificarCambioEstadoOrden(orden, orden.cliente);
}

export async function listarOrdenes(req: Request, res: Response): Promise<void> {
  const ordenes = await Orden.findAll({
    where: filtroDeOrdenes(sucursalIdDe(req), listarOrdenesQuery.parse(req.query)),
    include: INCLUDES_LISTADO,
    order: [['createdAt', 'DESC']],
    limit: LIMITE_LISTADO
  });
  res.json(ordenes);
}

/** Saldo del cliente en la moneda de la orden: es el único que la entrega puede usar. */
const saldoEnMonedaDe = (orden: Orden) => saldoDeCliente(orden.tallerId, orden.clienteId, orden.moneda);

/** Va con el saldo del cliente, para que la entrega pueda ofrecer aplicar el saldo a favor. */
export async function obtenerOrden(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, { include: INCLUDES_DETALLE });
  res.json({ ...orden.get({ plain: true }), saldoCliente: await saldoEnMonedaDe(orden) });
}

export async function crearOrden(req: Request, res: Response): Promise<void> {
  const data = crearOrdenSchema.parse(req.body);
  const orden = await crearOrdenConDatos(data, {
    tallerId: tallerIdDe(req),
    sucursalId: sucursalIdDe(req),
    usuarioId: usuarioDe(req).userId,
    esAdmin: esAdmin(req)
  });
  res.status(201).json(orden);
}

export async function actualizarOrden(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  exigirEditable(orden, esAdmin(req));
  await orden.update(actualizarOrdenSchema.parse(req.body));
  res.json(orden);
}

export async function cambiarEstadoOrden(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, CON_CLIENTE);
  const { estado: nuevoEstado, comentario, notaInterna, forzar } = cambiarEstadoSchema.parse(req.body);
  const estadoAnterior = orden.estado;

  // La entrega mueve plata y tiene su propio endpoint: por acá el equipo
  // saldría entregado sin registrar cuánto se cobró.
  if (nuevoEstado === 'entregado') {
    throw errores.conflicto('Para entregar el equipo hay que registrar el cobro desde la entrega.');
  }
  if (nuevoEstado === estadoAnterior) {
    throw errores.solicitudInvalida(`La orden ya está en estado "${etiquetaEstado(estadoAnterior)}"`);
  }

  const forzado = !esTransicionValida(estadoAnterior, nuevoEstado);
  if (forzado) {
    // El admin puede salirse del circuito cuando la realidad no entra en el
    // diagrama, pero tiene que dejar asentado por qué.
    if (!(forzar && esAdmin(req))) {
      const posibles = transicionesDesde(estadoAnterior).map(etiquetaEstado);
      throw errores.conflicto(
        posibles.length > 0
          ? `No se puede pasar de "${etiquetaEstado(estadoAnterior)}" a "${etiquetaEstado(nuevoEstado)}". Estados posibles: ${posibles.join(', ')}.`
          : `La orden está en "${etiquetaEstado(estadoAnterior)}" y no admite más cambios de estado.`
      );
    }
    if (!comentario) {
      throw errores.solicitudInvalida(
        'Para forzar un cambio de estado fuera del circuito hay que indicar el motivo'
      );
    }
  }

  await sequelize.transaction(async (transaction) => {
    await orden.update({ estado: nuevoEstado }, { transaction });
    await registrarCambioDeEstado(
      {
        ordenId: orden.id,
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        usuarioId: usuarioDe(req).userId,
        comentario: forzado ? `[Forzado] ${comentario}` : comentario,
        notaInterna
      },
      transaction
    );
  });

  res.json({ ...orden.get({ plain: true }), notificacion: await avisarSiCambio(orden, estadoAnterior) });
}

/** Entrega desde el mostrador. La lógica vive en `entrega.service`. */
export async function entregarOrden(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  const datos = entregaSchema.parse(req.body);

  const entrega = await ejecutarEntrega({
    ...datos,
    ordenId: orden.id,
    tallerId: orden.tallerId,
    usuarioId: usuarioDe(req).userId,
    sucursalId: sucursalIdDe(req),
    puedeForzar: esAdmin(req)
  });

  res.json({
    ...entrega.orden.get({ plain: true }),
    notificacion: entrega.notificacion,
    pendiente: entrega.pendiente,
    creditoAplicado: entrega.creditoAplicado,
    saldoCliente: await saldoEnMonedaDe(orden)
  });
}

/**
 * Pide autorización para entregar dejando deuda en un cliente sin cuenta
 * corriente: la salida del mostrador cuando la entrega se rechaza y el cliente
 * está esperando en el local.
 *
 * Si quien pide ya es admin, no espera su propia aprobación: se entrega en el
 * acto y queda igual la solicitud aprobada como registro del responsable.
 */
export async function solicitarFiado(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, CON_CLIENTE);
  const { montoTotal, montoAbonado, medioPago, motivo } = solicitarFiadoSchema.parse(req.body);
  const cliente = orden.cliente!;

  if (orden.estado === 'entregado') throw errores.conflicto('La orden ya fue entregada');
  if (cliente.cuentaCorrienteHabilitada) {
    throw errores.solicitudInvalida(
      'El cliente ya tiene cuenta corriente: la entrega se puede hacer directo'
    );
  }

  // Con el saldo a favor descontado puede no quedar deuda: no hay nada que autorizar.
  const { pendiente } = repartirEntrega(await saldoEnMonedaDe(orden), montoTotal, montoAbonado);
  if (pendiente <= 0) throw errores.solicitudInvalida('No hace falta autorización: la orden queda cubierta');

  const usuario = usuarioDe(req);
  const pedido = {
    tallerId: orden.tallerId,
    solicitanteId: usuario.userId,
    sucursalId: sucursalIdDe(req),
    cliente,
    ordenId: orden.id,
    pendiente,
    moneda: orden.moneda,
    motivo,
    datos: { montoTotal, montoAbonado, medioPago: medioPago ?? null }
  };

  if (!esAdmin(req)) {
    res.status(201).json({ solicitud: await pedirFiado(pedido), autorizada: false });
    return;
  }

  const admin = await User.findByPk(usuario.userId, { attributes: ['nombre', 'apellido'] });
  const { solicitud, entrega } = await fiarComoAdmin(pedido, nombreCompleto(admin) || 'un administrador');

  res.status(201).json({
    solicitud,
    autorizada: true,
    notificacion: entrega.notificacion,
    creditoAplicado: entrega.creditoAplicado,
    saldoCliente: await saldoEnMonedaDe(orden)
  });
}

/**
 * Carga el monto del presupuesto y/o la respuesta del cliente.
 *
 * Cargar el monto es, en la práctica, presupuestar: si el circuito lo permite
 * la orden avanza sola a "presupuestado", así el mostrador no lo hace aparte.
 *
 * La moneda se elige junto con el monto. Una vez entregada la orden no se
 * cambia: lo cobrado ya quedó asentado en la cuenta en esa moneda.
 */
export async function actualizarPresupuesto(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, CON_CLIENTE);
  exigirEditable(orden, esAdmin(req));
  const { monto, moneda, aprobado } = presupuestoSchema.parse(req.body);
  const estadoAnterior = orden.estado;

  const cambios: Partial<Pick<Orden, 'presupuestoMonto' | 'presupuestoAprobado' | 'estado' | 'moneda'>> = {};

  if (moneda !== undefined && moneda !== orden.moneda) {
    if (orden.montoTotal != null) {
      throw errores.conflicto(
        `La orden ya se cobró en ${orden.moneda}: la moneda no se puede cambiar después de la entrega.`
      );
    }
    cambios.moneda = moneda;
  }

  if (monto !== undefined) {
    cambios.presupuestoMonto = monto;
    if (monto !== null && esTransicionValida(estadoAnterior, 'presupuestado'))
      cambios.estado = 'presupuestado';
  }

  if (aprobado !== undefined && aprobado !== null) {
    const destino = aprobado ? 'aprobado' : 'rechazado';
    const estadoBase = cambios.estado ?? estadoAnterior;
    if (!esTransicionValida(estadoBase, destino)) {
      throw errores.conflicto(
        `Para registrar la respuesta del cliente, la orden tiene que estar presupuestada (hoy está en "${etiquetaEstado(estadoBase)}").`
      );
    }
    cambios.presupuestoAprobado = aprobado;
    cambios.estado = destino;
  }

  await sequelize.transaction(async (transaction) => {
    await orden.update(cambios, { transaction });
    if (orden.estado !== estadoAnterior) {
      await registrarCambioDeEstado(
        {
          ordenId: orden.id,
          estadoAnterior,
          estadoNuevo: orden.estado,
          usuarioId: usuarioDe(req).userId,
          comentario: 'Actualización de presupuesto'
        },
        transaction
      );
    }
  });

  res.json({ ...orden.get({ plain: true }), notificacion: await avisarSiCambio(orden, estadoAnterior) });
}

export async function reemplazarChequeos(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  exigirEditable(orden, esAdmin(req));
  const chequeos = chequeosSchema.parse(req.body);

  await sequelize.transaction(async (transaction) => {
    await OrdenChequeo.destroy({ where: { ordenId: orden.id }, transaction });
    await OrdenChequeo.bulkCreate(filasDeChequeo(orden.id, chequeos), { transaction });
  });

  res.json(await OrdenChequeo.findAll({ where: { ordenId: orden.id }, order: [['orden', 'ASC']] }));
}

export async function subirImagenes(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  exigirEditable(orden, esAdmin(req));

  const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (archivos.length === 0) throw errores.solicitudInvalida('No se recibieron imágenes');

  const storage = getStorageProvider();
  const imagenes = await Promise.all(
    archivos.map(async (archivo) => {
      // La extensión sale del mime que ya validó multer, nunca del nombre del
      // archivo: `originalname` puede traer `../` y escaparse del directorio.
      const clave = `ordenes/${orden.id}/${randomUUID()}.${extensionPara(archivo.mimetype)}`;
      const { url, storageKey } = await storage.upload(archivo.buffer, clave, archivo.mimetype);
      return OrdenImagen.create({
        ordenId: orden.id,
        url,
        storageKey,
        descripcion: req.body?.descripcion ?? null
      });
    })
  );

  res.status(201).json(imagenes);
}

export async function eliminarImagen(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  exigirEditable(orden, esAdmin(req));

  const imagen = await OrdenImagen.findOne({ where: { id: paramId(req, 'imagenId'), ordenId: orden.id } });
  if (!imagen) throw errores.noEncontrado('Imagen');

  await imagen.destroy();
  await getStorageProvider().delete(imagen.storageKey);
  res.status(204).send();
}

/**
 * Guarda la firma del cliente, cifrada en la fila de la orden.
 *
 * No va al almacenamiento público: es un dato personal y con el driver local
 * quedaba servida por `express.static` a quien tuviera la URL. Una vez firmada
 * no se reemplaza, porque es la constancia de lo que el cliente aceptó.
 */
export async function guardarFirma(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  if (orden.firmaClienteAt) throw errores.conflicto('La orden ya tiene la firma del cliente');

  const { firmaBase64 } = firmaSchema.parse(req.body);
  const png = Buffer.from(firmaBase64.replace(FIRMA_PNG, ''), 'base64');
  if (!png.subarray(0, CABECERA_PNG.length).equals(CABECERA_PNG)) {
    throw errores.solicitudInvalida('La firma tiene que ser una imagen PNG');
  }

  const firmadaEn = new Date();
  await orden.update({ firmaClienteEnc: encryptBuffer(png), firmaClienteAt: firmadaEn });
  res.json({ firmaClienteAt: firmadaEn.toISOString() });
}

/**
 * Devuelve el PNG de la firma descifrado. Pasa por acá (y no como archivo
 * estático) para exigir sesión: la firma identifica a una persona.
 */
export async function obtenerFirma(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, { conFirma: true });
  const firma = decryptBuffer(orden.firmaClienteEnc);

  if (!firma) {
    // Las órdenes firmadas antes del cifrado conservan su archivo en el almacenamiento.
    if (orden.firmaClienteUrl) {
      res.redirect(orden.firmaClienteUrl);
      return;
    }
    throw errores.noEncontrado('Firma');
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(firma);
}

/** Remito en PDF. `conFirma` levanta la exclusión del scope por defecto: el remito imprime la firma. */
export async function descargarPdf(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, { include: INCLUDES_DETALLE, conFirma: true });
  const pdf = await generarOrdenPdf(orden);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${orden.numeroOrden}.pdf"`);
  res.send(pdf);
}
