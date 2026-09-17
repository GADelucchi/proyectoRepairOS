import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { Orden } from '../models/Orden';
import { Cliente } from '../models/Cliente';
import { Equipo } from '../models/Equipo';
import { OrdenChequeo } from '../models/OrdenChequeo';
import { OrdenHistorialEstado } from '../models/OrdenHistorialEstado';
import { Sucursal } from '../models/Sucursal';
import { etiquetaEstado } from './notificationService';

interface OrdenPdfData {
  orden: Orden;
  cliente: Cliente;
  equipo: Equipo;
  chequeos: OrdenChequeo[];
  historial?: OrdenHistorialEstado[];
  sucursal?: Sucursal | null;
  tipoEquipoNombre: string;
  tecnicoNombre: string;
}

/** Condiciones que el cliente acepta al firmar la recepción del equipo. */
const TERMINOS = [
  'El taller no se responsabiliza por la información almacenada en el equipo. El cliente declara haber realizado una copia de seguridad o renunciar a ella.',
  'El diagnóstico puede revelar fallas adicionales a las declaradas. Toda reparación se realiza únicamente con presupuesto aprobado por el cliente.',
  'El estado estético registrado en esta orden, junto con las fotografías tomadas al ingreso, es el aceptado por ambas partes.',
  'Los equipos no retirados dentro de los 90 días de notificada su finalización podrán generar costos de depósito.',
  'La garantía cubre exclusivamente la reparación efectuada y no alcanza fallas ajenas a ella, golpes o daños por líquidos posteriores a la entrega.'
];

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/** Formatea un `YYYY-MM-DD` sin pasar por Date, que lo correría un día por zona horaria. */
function formatearFechaISO(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!match) return fecha;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatearFechaHora(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

function formatearMonto(monto: number | string): string {
  return Number(monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

export async function generarOrdenPdf(data: OrdenPdfData): Promise<Buffer> {
  const { orden, cliente, equipo, chequeos, historial, sucursal, tipoEquipoNombre, tecnicoNombre } = data;

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
  if (orden.fechaPactada) dato('Fecha pactada de entrega', formatearFechaISO(orden.fechaPactada));
  dato('Estado actual', etiquetaEstado(orden.estado));

  // ---------- Cliente ----------
  seccion('Datos del cliente');
  dato('Nombre', `${cliente.nombre} ${cliente.apellido}`);
  if (cliente.dniCuit) dato('DNI/CUIT', cliente.dniCuit);
  if (cliente.telefono) dato('Teléfono', cliente.telefono);
  if (cliente.email) dato('Email', cliente.email);
  if (cliente.direccion) dato('Dirección', cliente.direccion);
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
    dato('Monto', formatearMonto(orden.presupuestoMonto));
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
    const total = Number(orden.montoTotal);
    const abonado = Number(orden.montoAbonado ?? 0);
    const pendiente = Math.round((total - abonado) * 100) / 100;

    const credito = Number(orden.creditoAplicado ?? 0);
    const adeudado = Math.round((pendiente - credito) * 100) / 100;

    seccion('Entrega y cobro');
    if (orden.fechaEntrega) dato('Fecha de entrega', formatearFechaHora(orden.fechaEntrega));
    dato('Total', formatearMonto(total));
    dato('Abonado', formatearMonto(abonado));
    if (credito > 0) {
      dato('Saldo a favor aplicado', formatearMonto(credito));
    }
    if (adeudado > 0) {
      dato('Saldo en cuenta corriente', formatearMonto(adeudado));
    }
  }

  // ---------- Historial ----------
  if (historial && historial.length > 0) {
    seccion('Historial de estados');
    historial.forEach((h) => {
      const usuario = (h as any).usuario;
      const quien = usuario ? ` — ${usuario.nombre} ${usuario.apellido}` : '';
      const desde = h.estadoAnterior ? `${etiquetaEstado(h.estadoAnterior as never)} -> ` : '';
      doc
        .fontSize(9)
        .text(
          `${formatearFechaHora(h.createdAt)}  ${desde}${etiquetaEstado(h.estadoNuevo as never)}${quien}` +
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
  TERMINOS.forEach((termino, i) => {
    doc.text(`${i + 1}. ${termino}`, { align: 'justify' });
    doc.moveDown(0.4);
  });

  // ---------- Firma ----------
  doc.moveDown(1.2);
  doc.fontSize(10).text('Conformidad del cliente', { underline: true });
  doc.moveDown(0.5);
  doc
    .fontSize(9)
    .text(
      'Al firmar, el cliente declara haber leído y aceptado los términos precedentes, y estar de acuerdo con el estado del equipo registrado en esta orden.'
    );
  doc.moveDown(0.6);

  let firmaImpresa = false;
  if (orden.firmaClienteUrl) {
    const firma = await fetchImageBuffer(orden.firmaClienteUrl);
    if (firma) {
      try {
        doc.image(firma, { width: 180 });
        firmaImpresa = true;
      } catch {
        // Una firma corrupta no debe romper la generación del remito.
      }
    }
  }

  if (!firmaImpresa) {
    doc.moveDown(2.5);
    doc.text('______________________________');
  }

  doc.fontSize(9).text(`${cliente.nombre} ${cliente.apellido}`);
  if (cliente.dniCuit) doc.text(`DNI/CUIT: ${cliente.dniCuit}`);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
