import type { EstadoOrden, Moneda, Monto } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';

/** Lo necesario para armar el mensaje al cliente. Sale de una orden o de las listas del tablero. */
export interface DatosAviso {
  numeroOrden: string;
  estado: EstadoOrden;
  codigoSeguimiento?: string | null;
  presupuestoMonto?: Monto | null;
  presupuestoDetalle?: string | null;
  moneda: Moneda;
  clienteNombre?: string | null;
  clienteTelefono?: string | null;
  marca?: string | null;
  modelo?: string | null;
  sucursal?: { nombre: string; direccion?: string | null } | null;
}

/** Link público de seguimiento, con el dominio desde el que se usa la app. */
export const urlDeSeguimiento = (codigo: string) => `${window.location.origin}/seguimiento/${codigo}`;

/**
 * Mensaje de WhatsApp según el estado de la orden. Es una propuesta: la pantalla
 * lo deja editar antes de abrir WhatsApp.
 */
export function mensajeParaCliente(d: DatosAviso, taller: string): string {
  const hola = d.clienteNombre ? `Hola ${d.clienteNombre.trim()}!` : 'Hola!';
  const equipo = `${d.marca ?? ''} ${d.modelo ?? ''}`.trim() || 'equipo';
  const lugar = d.sucursal
    ? `${d.sucursal.nombre}${d.sucursal.direccion ? ` (${d.sucursal.direccion})` : ''}`
    : taller;
  const monto = d.presupuestoMonto != null ? formatearMonto(d.presupuestoMonto, d.moneda) : null;
  // El detalle va en su propio párrafo, entre el monto y la pregunta.
  const detalle = d.presupuestoDetalle?.trim() ? `\n\n${d.presupuestoDetalle.trim()}\n\n` : ' ';

  const reparando = `Estamos reparando tu ${equipo} (orden ${d.numeroOrden}). Te avisamos cuando esté listo.`;
  const cuerpo: Record<EstadoOrden, string> = {
    // El "cliente" de esta orden es el taller que nos tercerizó el equipo.
    por_recibir: `Ya tenemos armada la orden ${d.numeroOrden} para tu ${equipo}. Cuando nos lo mandes, lo recibimos.`,
    recibido: `Recibimos tu ${equipo} en ${taller}. Tu número de orden es ${d.numeroOrden}.`,
    en_diagnostico: `Estamos revisando tu ${equipo} (orden ${d.numeroOrden}). Te avisamos apenas tengamos el diagnóstico.`,
    presupuestado: monto
      ? `El presupuesto para reparar tu ${equipo} (orden ${d.numeroOrden}) es de ${monto}.${detalle}¿Lo aprobás? Respondé este mensaje y seguimos.`
      : `Ya tenemos el presupuesto para tu ${equipo} (orden ${d.numeroOrden}). ¿Te lo pasamos?`,
    aprobado: `Gracias por aprobar el presupuesto. Ya empezamos con la reparación de tu ${equipo} (orden ${d.numeroOrden}).`,
    rechazado: `Registramos que no vas a seguir con la reparación de tu ${equipo} (orden ${d.numeroOrden}). Podés pasar a retirarlo por ${lugar}.`,
    en_reparacion: reparando,
    // Que esté en un taller externo es cosa del taller: para el cliente, se está reparando.
    externo: reparando,
    en_espera: `Tu ${equipo} (orden ${d.numeroOrden}) quedó en espera. Te avisamos apenas podamos seguir.`,
    listo_para_retirar: `¡Tu ${equipo} ya está listo para retirar! Te esperamos en ${lugar}. Orden ${d.numeroOrden}${monto ? `, total ${monto}` : ''}.`,
    no_reparado: `No pudimos reparar tu ${equipo} (orden ${d.numeroOrden}). Ya podés pasar a retirarlo por ${lugar}.`,
    entregado: `Gracias por confiar en ${taller}. Si tenés cualquier consulta sobre la reparación de tu ${equipo}, escribinos.`,
    cancelado: `La orden ${d.numeroOrden} de tu ${equipo} quedó cancelada. Ante cualquier duda, escribinos.`
  };

  const seguimiento =
    d.codigoSeguimiento && d.estado !== 'entregado'
      ? `\n\nPodés ver el estado cuando quieras acá: ${urlDeSeguimiento(d.codigoSeguimiento)}`
      : '';
  return `${hola} ${cuerpo[d.estado]}${seguimiento}`;
}

/** Los datos del aviso a partir de una orden completa (la del detalle). */
export function datosAvisoDeOrden(orden: {
  numeroOrden: string;
  estado: DatosAviso['estado'];
  codigoSeguimiento?: string | null;
  presupuestoMonto?: DatosAviso['presupuestoMonto'];
  presupuestoDetalle?: DatosAviso['presupuestoDetalle'];
  moneda: DatosAviso['moneda'];
  cliente?: { nombre?: string | null; telefono?: string | null } | null;
  equipo?: { marca?: string | null; modelo?: string | null } | null;
  sucursal?: { nombre: string; direccion?: string | null } | null;
}): DatosAviso {
  return {
    numeroOrden: orden.numeroOrden,
    estado: orden.estado,
    codigoSeguimiento: orden.codigoSeguimiento,
    presupuestoMonto: orden.presupuestoMonto,
    presupuestoDetalle: orden.presupuestoDetalle,
    moneda: orden.moneda,
    clienteNombre: orden.cliente?.nombre,
    clienteTelefono: orden.cliente?.telefono,
    marca: orden.equipo?.marca,
    modelo: orden.equipo?.modelo,
    sucursal: orden.sucursal
  };
}
