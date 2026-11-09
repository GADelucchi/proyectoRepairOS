import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { env } from '../../config/env';
import type { Taller, Venta } from '../../models';
import { ETIQUETA_MEDIO_PAGO } from '../../models/CuentaMovimiento';
import type { EstadoVenta } from '../../models/Venta';
import { aNumero, formatearMonto, redondearMonto } from '../../shared/utils/dinero';
import { formatearFechaHora as fechaHoraEnZona, formatearFechaIso } from '../../shared/utils/fechas';
import { nombreCompleto } from '../../shared/utils/texto';
import { etiquetaVenta } from './calculos';

/**
 * Comprobante de una venta de equipos, para entregar al cliente: quién vende,
 * a quién, qué se lleva, qué deja en parte de pago, cuánto pagó y los términos
 * y condiciones que configuró el taller.
 *
 * No es una factura: lo dice arriba. La venta se puede facturar aparte.
 *
 * Espera la venta con `cliente`, `sucursal`, `vendedor`, `items.equipo`,
 * `partesPago` y `pagos` cargados. Nunca imprime costos ni comentarios internos.
 */

const ETIQUETA_ESTADO: Record<EstadoVenta, string> = {
  reservada: 'Reserva',
  senada: 'Seña',
  completada: 'Venta',
  cancelada: 'Cancelada',
  vencida: 'Reserva vencida',
  anulada: 'Venta anulada'
};

const CONDICION_IVA: Record<string, string> = {
  monotributo: 'Monotributista',
  responsable_inscripto: 'Responsable inscripto',
  exento: 'Exento'
};

const TIPO_PAGO: Record<string, string> = { sena: 'Seña', pago: 'Pago', devolucion: 'Devolución' };

interface DescripcionEquipo {
  numero?: number | null;
  marca: string;
  modelo: string;
  color: string | null;
  almacenamientoGb: number | null;
  condicion: string;
  bateria: number | null;
  numeroSerie: string | null;
  imei: string | null;
  imei2: string | null;
}

const almacenamiento = (gb: number | null) => (!gb ? null : gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`);

function titulo(e: DescripcionEquipo): string {
  return [e.marca, e.modelo, almacenamiento(e.almacenamientoGb), e.color].filter(Boolean).join(' ');
}

function detalleDe(e: DescripcionEquipo): string {
  const condicion =
    e.condicion === 'nuevo' ? 'Nuevo' : e.bateria != null ? `Usado · batería ${e.bateria} %` : 'Usado';
  const ids = [
    e.imei && `IMEI ${e.imei}`,
    e.imei2 && `IMEI 2 ${e.imei2}`,
    e.numeroSerie && `Serie ${e.numeroSerie}`
  ].filter(Boolean);
  return [condicion, ...ids].join(' · ');
}

/** Deber de información de la Ley 25.326, en corto: el detalle está en la orden de reparación. */
function avisoDeDatos(nombre: string, contacto: string | null): string {
  return `Sus datos personales son tratados por ${nombre} para gestionar esta venta, emitir los comprobantes correspondientes y cumplir con la garantía. No se ceden a terceros con fines comerciales. Puede acceder a ellos, rectificarlos o pedir su supresión contactando a ${contacto ?? 'el local'}. El titular puede ejercer el derecho de acceso en forma gratuita a intervalos no inferiores a seis meses (art. 14, inc. 3, Ley 25.326). La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias y reclamos por incumplimiento de las normas de protección de datos personales.`;
}

const formatearFechaHora = (fecha: Date | string) => fechaHoraEnZona(fecha, env.timezone);

export async function generarVentaPdf(venta: Venta, taller: Taller): Promise<Buffer> {
  const { cliente, sucursal } = venta;
  if (!cliente) throw new Error('La venta tiene que venir con el cliente cargado');
  const moneda = venta.moneda;
  const plata = (valor: number | string) => formatearMonto(valor, moneda);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  doc.pipe(stream);

  const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const izquierda = doc.page.margins.left;

  const seccion = (texto: string) => {
    doc.moveDown(0.6);
    doc.fontSize(12).fillColor('#000000').text(texto, izquierda, doc.y, { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
  };

  const dato = (etiqueta: string, valor: string) => {
    doc.fontSize(10).text(`${etiqueta}: `, { continued: true }).fillColor('#333333').text(valor);
    doc.fillColor('#000000');
  };

  /** Un renglón con la descripción a la izquierda y el monto a la derecha. */
  const renglon = (texto: string, monto: string, opciones: { negrita?: boolean; sub?: string } = {}) => {
    const y = doc.y;
    doc.font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    doc.text(texto, izquierda, y, { width: ancho - 120 });
    const finTexto = doc.y;
    doc.text(monto, izquierda + ancho - 120, y, { width: 120, align: 'right' });
    doc.font('Helvetica');
    doc.y = Math.max(finTexto, doc.y);
    if (opciones.sub) {
      doc
        .fontSize(8.5)
        .fillColor('#555555')
        .text(opciones.sub, izquierda, doc.y, { width: ancho - 120 });
      doc.fillColor('#000000').fontSize(10);
    }
    doc.moveDown(0.2);
  };

  // ---------- Encabezado ----------
  doc.fontSize(17).text(`Comprobante de ${ETIQUETA_ESTADO[venta.estado].toLowerCase()}`, { align: 'center' });
  doc.fontSize(12).text(etiquetaVenta(venta.numero), { align: 'center' });
  doc.fontSize(8).fillColor('#666666').text('Documento no válido como factura', { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(0.7);

  // ---------- Quién vende ----------
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(taller.razonSocial || taller.nombre);
  doc.font('Helvetica').fontSize(10);
  if (taller.razonSocial && taller.razonSocial !== taller.nombre) dato('Nombre de fantasía', taller.nombre);
  if (taller.cuit) dato('CUIT', taller.cuit);
  if (taller.condicionIva)
    dato('Condición frente al IVA', CONDICION_IVA[taller.condicionIva] ?? taller.condicionIva);
  if (sucursal) {
    dato('Sucursal', sucursal.nombre);
    if (sucursal.direccion) dato('Dirección', sucursal.direccion);
    if (sucursal.telefono) dato('Teléfono', sucursal.telefono);
  }
  dato('Fecha', formatearFechaHora(venta.createdAt));
  if (venta.vendedor) dato('Atendió', nombreCompleto(venta.vendedor));
  if (venta.estado === 'reservada' && venta.reservadaHasta) {
    dato('Reservado hasta', formatearFechaIso(venta.reservadaHasta));
  }
  if (venta.estado === 'cancelada' && venta.canceladaEn)
    dato('Cancelada el', formatearFechaHora(venta.canceladaEn));
  if (venta.estado === 'anulada' && venta.canceladaEn)
    dato('Anulada el', formatearFechaHora(venta.canceladaEn));

  // ---------- Cliente ----------
  seccion('Cliente');
  dato('Nombre', nombreCompleto(cliente));
  if (cliente.dniCuit) dato('DNI/CUIT', cliente.dniCuit);
  if (cliente.telefono) dato('Teléfono', cliente.telefono);
  if (cliente.email) dato('Email', cliente.email);
  if (cliente.direccion) dato('Dirección', [cliente.direccion, cliente.ciudad].filter(Boolean).join(', '));

  // ---------- Lo que se lleva ----------
  seccion(venta.items && venta.items.length > 1 ? 'Equipos que se lleva' : 'Equipo que se lleva');
  for (const item of venta.items ?? []) {
    if (!item.equipo) continue;
    renglon(titulo(item.equipo), plata(item.precio), { sub: detalleDe(item.equipo) });
  }

  // ---------- Lo que deja ----------
  const partes = venta.partesPago ?? [];
  if (partes.length > 0) {
    seccion(partes.length > 1 ? 'Equipos que deja como parte de pago' : 'Equipo que deja como parte de pago');
    for (const parte of partes) renglon(titulo(parte), `- ${plata(parte.monto)}`, { sub: detalleDe(parte) });
  }

  // ---------- Totales ----------
  seccion('Importe');
  const descuento = aNumero(venta.descuento);
  if (descuento > 0 || partes.length > 0) renglon('Subtotal', plata(venta.subtotal));
  if (descuento > 0) {
    const porcentaje = venta.descuentoTipo === 'porcentaje' ? ` (${aNumero(venta.descuentoValor)} %)` : '';
    renglon(`Descuento${porcentaje}`, `- ${plata(descuento)}`);
  }
  renglon('Total', plata(venta.total), { negrita: true });
  if (partes.length > 0) renglon('Parte de pago', `- ${plata(venta.partePago)}`);

  const pagos = venta.pagos ?? [];
  let pagado = 0;
  for (const pago of pagos) {
    const signo = pago.tipo === 'devolucion' ? -1 : 1;
    pagado += signo * aNumero(pago.equivalente);
    const medio = pago.medioPago ? ` · ${ETIQUETA_MEDIO_PAGO[pago.medioPago]}` : '';
    // En otra moneda: lo que entró, con la cotización, y a la derecha lo que cubre de la venta.
    const enOtraMoneda =
      pago.moneda === moneda
        ? undefined
        : `${formatearMonto(pago.monto, pago.moneda)}${pago.cotizacion ? ` (1 US$ = ${aNumero(pago.cotizacion).toLocaleString('es-AR')} ${pago.moneda === 'USD' ? moneda : pago.moneda})` : ''}`;
    renglon(
      `${TIPO_PAGO[pago.tipo]} del ${formatearFechaHora(pago.createdAt)}${medio}`,
      `${signo < 0 ? '+' : '-'} ${plata(pago.equivalente)}`,
      { sub: enOtraMoneda }
    );
  }
  if (venta.estado === 'reservada' || venta.estado === 'senada') {
    const saldo = redondearMonto(aNumero(venta.total) - aNumero(venta.partePago) - pagado);
    renglon('Saldo a pagar', plata(saldo), { negrita: true });
  }

  // ---------- Comentarios para el cliente ----------
  if (venta.comentarioCliente) {
    seccion('Observaciones');
    doc.fontSize(10).text(venta.comentarioCliente, izquierda, doc.y, { width: ancho, align: 'justify' });
  }

  // ---------- Términos ----------
  if (taller.terminosVenta) {
    seccion('Términos y condiciones');
    doc.fontSize(8.5).text(taller.terminosVenta, izquierda, doc.y, { width: ancho, align: 'justify' });
  }
  doc.moveDown(0.6);
  doc
    .fontSize(7.5)
    .fillColor('#555555')
    .text(avisoDeDatos(taller.razonSocial || taller.nombre, sucursal?.telefono ?? null), izquierda, doc.y, {
      width: ancho,
      align: 'justify'
    });
  doc.fillColor('#000000');

  // ---------- Firma ----------
  if (doc.y > doc.page.height - doc.page.margins.bottom - 90) doc.addPage();
  doc.moveDown(3);
  const y = doc.y;
  doc.fontSize(9).text('______________________________', izquierda, y);
  doc.text('Firma del cliente', izquierda, y + 12);
  doc.text(nombreCompleto(cliente), izquierda, y + 24);
  doc.text('______________________________', izquierda + ancho / 2, y);
  doc.text(`Por ${taller.nombre}`, izquierda + ancho / 2, y + 12);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
