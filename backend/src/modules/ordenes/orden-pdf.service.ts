import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PassThrough } from 'stream';
import { env } from '../../config/env';
import { Orden } from '../../models';
import { Sucursal } from '../../models/Sucursal';
import { decryptBuffer } from '../../shared/security/encryption';
import { aNumero, formatearMonto, redondearMonto } from '../../shared/utils/dinero';
import { formatearFechaHora as fechaHoraEnZona, formatearFechaIso } from '../../shared/utils/fechas';
import { nombreCompleto } from '../../shared/utils/texto';
import { urlDeSeguimiento } from '../seguimiento/codigo';
import { etiquetaEstado } from './estado-orden';

/**
 * Remito de la orden en PDF: datos del equipo, checklist, cobro, términos del
 * servicio y la firma del cliente.
 *
 * Espera la orden con `cliente`, `equipo.tipoEquipo`, `sucursal`, `tecnico`,
 * `chequeos` e `historialEstados` cargados, y con el scope `conFirma`.
 */

/** Condiciones que el cliente acepta al firmar la recepción del equipo. */
const TERMINOS = [
  'El taller no se responsabiliza por la información almacenada en el equipo. El cliente declara haber realizado una copia de seguridad o renunciar a ella.',
  'El diagnóstico puede revelar fallas adicionales a las declaradas. Toda reparación se realiza únicamente con presupuesto aprobado por el cliente.',
  'El estado estético registrado en esta orden, junto con las fotografías tomadas al ingreso, es el aceptado por ambas partes.',
  'Los equipos no retirados dentro de los 90 días de notificada su finalización podrán generar costos de depósito.',
  'La garantía cubre exclusivamente la reparación efectuada y no alcanza fallas ajenas a ella, golpes o daños por líquidos posteriores a la entrega.'
];

/**
 * Deber de información del art. 6 de la Ley 25.326.
 *
 * Sin esto, el taller recolecta datos personales (incluida la clave de
 * desbloqueo del equipo) sin haber informado al titular para qué los usa ni
 * cómo ejercer sus derechos.
 *
 * El nombre y el domicilio salen de la sucursal que recibe el equipo; el
 * contacto para ejercer derechos es el teléfono de esa misma sucursal.
 */
function terminosDeDatos(sucursal: Sucursal | null | undefined): string[] {
  const taller = sucursal?.nombre ?? 'el taller';
  const domicilio = sucursal?.direccion ? `, con domicilio en ${sucursal.direccion},` : '';
  const contacto = sucursal?.telefono ?? 'el taller donde dejó el equipo';

  return [
    `Sus datos personales son tratados por ${taller}${domicilio} con la finalidad de gestionar la recepción, reparación y entrega de su equipo, emitir los comprobantes correspondientes y mantenerlo informado sobre el estado de la orden.`,
    'Si usted entrega la clave de desbloqueo del equipo o credenciales de cuentas vinculadas, se almacenan cifradas y se utilizan exclusivamente para realizar y verificar la reparación. Cada consulta a esos datos queda registrada con identificación del técnico, fecha y hora.',
    'Los datos se conservan mientras dure la relación comercial y por los plazos que exija la normativa fiscal y contable. No se ceden a terceros con fines comerciales.',
    `Usted puede acceder a sus datos, rectificarlos, actualizarlos y solicitar su supresión contactando a ${contacto}. El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La Agencia de Acceso a la Información Pública, Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.`
  ];
}

/** Descarga la firma de las órdenes anteriores al cifrado, que quedó como archivo. */
async function descargarImagen(url: string): Promise<Buffer | null> {
  try {
    const respuesta = await fetch(url);
    return respuesta.ok ? Buffer.from(await respuesta.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Fecha y hora en la zona del taller: el servidor corre en UTC. */
const formatearFechaHora = (fecha: Date | string) => fechaHoraEnZona(fecha, env.timezone);

export async function generarOrdenPdf(orden: Orden): Promise<Buffer> {
  const { cliente, equipo, sucursal } = orden;
  if (!cliente || !equipo) throw new Error('La orden tiene que venir con cliente y equipo cargados');
  const chequeos = orden.chequeos ?? [];
  const historial = orden.historialEstados ?? [];
  const tipoEquipoNombre = equipo.tipoEquipo?.nombre ?? 'Sin especificar';
  const tecnicoNombre = nombreCompleto(orden.tecnico);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(chunk));
  doc.pipe(stream);

  const seccion = (titulo: string) => {
    doc.moveDown(0.6);
    doc.fontSize(12).fillColor('#000000').text(titulo, { underline: true });
    doc.moveDown(0.25);
    doc.fontSize(10);
  };

  const dato = (etiqueta: string, valor: string) => {
    doc.fontSize(10).text(`${etiqueta}: `, { continued: true }).fillColor('#333333').text(valor);
    doc.fillColor('#000000');
  };

  // ---------- Encabezado ----------
  doc.fontSize(17).text('Orden de reparación', { align: 'center' });
  doc.fontSize(12).text(orden.numeroOrden, { align: 'center' });
  doc.moveDown(0.7);

  doc.fontSize(10);
  if (sucursal) {
    dato('Sucursal', sucursal.nombre);
    if (sucursal.direccion) dato('Dirección', sucursal.direccion);
    if (sucursal.telefono) dato('Teléfono', sucursal.telefono);
  }
  dato('Técnico que recibió', tecnicoNombre || '-');
  dato('Fecha de ingreso', formatearFechaHora(orden.fechaIngreso));
  if (orden.fechaPactada) dato('Fecha pactada de entrega', formatearFechaIso(orden.fechaPactada));
  dato('Estado actual', etiquetaEstado(orden.estado));

  // QR al link público de seguimiento, arriba a la derecha: el cliente lo
  // escanea con el celular y ve el estado sin tener que llamar.
  if (orden.codigoSeguimiento) {
    const cursor = { x: doc.x, y: doc.y };
    const url = urlDeSeguimiento(orden.codigoSeguimiento);
    const qr = await QRCode.toBuffer(url, { type: 'png', margin: 1, width: 240, errorCorrectionLevel: 'M' });
    const lado = 78;
    const x = doc.page.width - doc.page.margins.right - lado;
    const y = doc.page.margins.top + 45;
    doc.image(qr, x, y, { width: lado, height: lado });
    doc
      .fontSize(7)
      .fillColor('#555555')
      .text('Seguí tu equipo', x - 6, y + lado + 2, { width: lado + 12, align: 'center', lineBreak: false });
    doc.fillColor('#000000').fontSize(10);
    // El texto en posición absoluta mueve el cursor: se vuelve adonde seguía el remito.
    doc.x = cursor.x;
    doc.y = cursor.y;
  }

  // ---------- Cliente ----------
  seccion('Datos del cliente');
  dato('Nombre', nombreCompleto(cliente));
  if (cliente.dniCuit) dato('DNI/CUIT', cliente.dniCuit);
  if (cliente.telefono) dato('Teléfono', cliente.telefono);
  if (cliente.email) dato('Email', cliente.email);
  if (cliente.direccion) dato('Dirección', cliente.direccion);
  if (cliente.ciudad) dato('Ciudad', cliente.ciudad);
  if (cliente.esGremio && cliente.nombreGremio) dato('Gremio / local', cliente.nombreGremio);

  // ---------- Equipo ----------
  seccion('Datos del equipo');
  dato('Tipo', tipoEquipoNombre);
  if (equipo.marca) dato('Marca', equipo.marca);
  if (equipo.modelo) dato('Modelo', equipo.modelo);
  if (equipo.color) dato('Color', equipo.color);
  if (equipo.numeroSerie) dato('Nº de serie', equipo.numeroSerie);
  // Las credenciales del equipo nunca se imprimen: el remito queda en manos del cliente.

  // ---------- Estado estético ----------
  if (orden.detallesEsteticos) {
    seccion('Estado estético al ingreso');
    doc.fontSize(10).text(orden.detallesEsteticos, { align: 'justify' });
  }

  // ---------- Checklist ----------
  if (chequeos.length > 0) {
    seccion('Chequeo de recepción');
    chequeos.forEach((c) => {
      doc.fontSize(10).text(`• ${c.item}: `, { continued: true });
      doc.fillColor(c.resultado ? '#000000' : '#888888').text(c.resultado ?? 'Sin responder');
      doc.fillColor('#000000');
    });
  }

  // ---------- Trabajo solicitado ----------
  seccion('Reparación / revisión solicitada');
  doc.fontSize(10).text(orden.reparacionSolicitada ?? '-', { align: 'justify' });

  // ---------- Presupuesto ----------
  if (orden.presupuestoMonto != null) {
    seccion('Presupuesto');
    dato('Monto', formatearMonto(orden.presupuestoMonto, orden.moneda));
    dato(
      'Respuesta del cliente',
      orden.presupuestoAprobado === true
        ? 'Aprobado'
        : orden.presupuestoAprobado === false
          ? 'Rechazado'
          : 'Pendiente'
    );
  }

  // ---------- Entrega y cobro ----------
  // Solo aparece si el equipo ya se entregó. Si el cliente quedó debiendo, el
  // remito impreso es la constancia de cuánto y de qué orden viene la deuda.
  if (orden.montoTotal != null) {
    const total = aNumero(orden.montoTotal);
    const abonado = aNumero(orden.montoAbonado);
    const credito = aNumero(orden.creditoAplicado);
    const adeudado = redondearMonto(total - abonado - credito);

    seccion('Entrega y cobro');
    if (orden.fechaEntrega) dato('Fecha de entrega', formatearFechaHora(orden.fechaEntrega));
    dato('Total', formatearMonto(total, orden.moneda));
    dato('Abonado', formatearMonto(abonado, orden.moneda));
    if (credito > 0) {
      dato('Saldo a favor aplicado', formatearMonto(credito, orden.moneda));
    }
    if (adeudado > 0) {
      dato('Saldo en cuenta corriente', formatearMonto(adeudado, orden.moneda));
    }
  }

  // ---------- Historial ----------
  // Solo el comentario: la nota interna de cada cambio es del taller y no se imprime.
  if (historial && historial.length > 0) {
    seccion('Historial de estados');
    historial.forEach((h) => {
      const quien = h.usuario ? ` — ${nombreCompleto(h.usuario)}` : '';
      const desde = h.estadoAnterior ? `${etiquetaEstado(h.estadoAnterior)} -> ` : '';
      doc
        .fontSize(9)
        .text(
          `${formatearFechaHora(h.createdAt)}  ${desde}${etiquetaEstado(h.estadoNuevo)}${quien}` +
            (h.comentario ? ` · ${h.comentario}` : '')
        );
    });
    doc.fontSize(10);
  }

  // ---------- Términos ----------
  doc.addPage();
  doc.fontSize(13).text('Términos y condiciones del servicio', { align: 'center' });
  doc.moveDown(0.8);
  doc.fontSize(9);
  const terminosDatos = terminosDeDatos(sucursal);
  TERMINOS.forEach((termino, i) => {
    doc.text(`${i + 1}. ${termino}`, { align: 'justify' });
    doc.moveDown(0.4);
  });

  doc.moveDown(0.4);
  doc.fontSize(10).text('Tratamiento de datos personales', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(8);
  terminosDatos.forEach((termino, i) => {
    doc.text(`${TERMINOS.length + i + 1}. ${termino}`, { align: 'justify' });
    doc.moveDown(0.3);
  });
  doc.fontSize(9);

  // ---------- Firma ----------
  doc.moveDown(1.2);
  doc.fontSize(10).text('Conformidad del cliente', { underline: true });
  doc.moveDown(0.5);
  doc
    .fontSize(9)
    .text(
      'Al firmar, el cliente declara haber leído y aceptado los términos precedentes, prestar su consentimiento para el tratamiento de sus datos personales en los términos indicados, y estar de acuerdo con el estado del equipo registrado en esta orden.'
    );
  doc.moveDown(0.6);

  let firmaImpresa = false;
  // La firma vive cifrada en la fila. Las órdenes anteriores al cifrado todavía
  // la tienen como archivo en el almacenamiento, así que se cae a la URL.
  const firmaBuffer =
    decryptBuffer(orden.firmaClienteEnc) ??
    (orden.firmaClienteUrl ? await descargarImagen(orden.firmaClienteUrl) : null);

  if (firmaBuffer) {
    try {
      doc.image(firmaBuffer, { width: 180 });
      firmaImpresa = true;
    } catch {
      // Una firma corrupta no debe romper la generación del remito.
    }
  }

  if (!firmaImpresa) {
    doc.moveDown(2.5);
    doc.text('______________________________');
  }

  doc.fontSize(9).text(nombreCompleto(cliente));
  if (cliente.dniCuit) doc.text(`DNI/CUIT: ${cliente.dniCuit}`);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
