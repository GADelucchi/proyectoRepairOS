import { Request, Response } from 'express';
import { errores } from '../../shared/http/http-error';
import { esAdmin, paramId, sucursalIdDe, tallerIdDe, usuarioDe } from '../../shared/http/request-context';
import { decryptBuffer } from '../../shared/security/encryption';
import { ejecutarEntrega } from './entrega.service';
import { solicitarFiado as pedirFiado } from './fiado.service';
import * as archivos from './orden-archivos.service';
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
import * as ordenes from './ordenes.service';

/** La orden de la URL, dentro de la sucursal activa. */
const ordenDe = (req: Request, opciones?: Parameters<typeof ordenes.buscarOrdenDeSucursal>[2]) =>
  ordenes.buscarOrdenDeSucursal(paramId(req), sucursalIdDe(req), opciones);

export async function listarOrdenes(req: Request, res: Response): Promise<void> {
  res.json(await ordenes.listarOrdenes(sucursalIdDe(req), listarOrdenesQuery.parse(req.query)));
}

/** Va con el saldo del cliente, para que la entrega pueda ofrecer aplicar el saldo a favor. */
export async function obtenerOrden(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, { include: ordenes.INCLUDES_DETALLE });
  res.json(await ordenes.conSaldoCliente(orden));
}

export async function crearOrden(req: Request, res: Response): Promise<void> {
  const data = crearOrdenSchema.parse(req.body);
  const orden = await ordenes.crearOrden(data, {
    tallerId: tallerIdDe(req),
    sucursalId: sucursalIdDe(req),
    usuarioId: usuarioDe(req).userId,
    esAdmin: esAdmin(req)
  });
  res.status(201).json(orden);
}

export async function actualizarOrden(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  ordenes.exigirEditable(orden, esAdmin(req));
  res.json(await ordenes.actualizarOrden(orden, actualizarOrdenSchema.parse(req.body)));
}

export async function cambiarEstadoOrden(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, ordenes.CON_CLIENTE);
  const datos = cambiarEstadoSchema.parse(req.body);
  res.json(
    await ordenes.cambiarEstado(orden, datos, { usuarioId: usuarioDe(req).userId, esAdmin: esAdmin(req) })
  );
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
    saldoCliente: await ordenes.saldoEnMonedaDe(orden)
  });
}

/** Pide autorización para entregar dejando deuda (ver `fiado.service`). */
export async function solicitarFiado(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, ordenes.CON_CLIENTE);
  const datos = solicitarFiadoSchema.parse(req.body);
  const resultado = await pedirFiado(orden, datos, {
    usuarioId: usuarioDe(req).userId,
    sucursalId: sucursalIdDe(req),
    esAdmin: esAdmin(req)
  });
  res.status(201).json(resultado);
}

/** Monto del presupuesto y/o respuesta del cliente (ver `ordenes.actualizarPresupuesto`). */
export async function actualizarPresupuesto(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req, ordenes.CON_CLIENTE);
  ordenes.exigirEditable(orden, esAdmin(req));
  const datos = presupuestoSchema.parse(req.body);
  res.json(await ordenes.actualizarPresupuesto(orden, datos, usuarioDe(req).userId));
}

export async function reemplazarChequeos(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  ordenes.exigirEditable(orden, esAdmin(req));
  res.json(await ordenes.reemplazarChequeos(orden, chequeosSchema.parse(req.body)));
}

export async function subirImagenes(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  ordenes.exigirEditable(orden, esAdmin(req));

  const subidos = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (subidos.length === 0) throw errores.solicitudInvalida('No se recibieron imágenes');

  res.status(201).json(await archivos.subirImagenes(orden, subidos, req.body?.descripcion ?? null));
}

export async function eliminarImagen(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  ordenes.exigirEditable(orden, esAdmin(req));
  await archivos.eliminarImagen(orden, paramId(req, 'imagenId'));
  res.status(204).send();
}

/** Guarda la firma del cliente, cifrada (ver `orden-archivos.service`). */
export async function guardarFirma(req: Request, res: Response): Promise<void> {
  const orden = await ordenDe(req);
  archivos.exigirSinFirma(orden);
  const { firmaBase64 } = firmaSchema.parse(req.body);
  const firmadaEn = await archivos.guardarFirma(orden, firmaBase64);
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
  const orden = await ordenDe(req, { include: ordenes.INCLUDES_DETALLE, conFirma: true });
  const pdf = await generarOrdenPdf(orden);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${orden.numeroOrden}.pdf"`);
  res.send(pdf);
}
