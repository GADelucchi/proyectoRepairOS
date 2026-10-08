import type { EstadoOrden, Moneda, Monto } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';

/** Lo necesario para armar el mensaje al cliente. Sale de una orden o de las listas del tablero. */
export interface DatosAviso {
  numeroOrden: string;
  estado: EstadoOrden;
  codigoSeguimiento?: string | null;
  presupuestoMonto?: Monto | null;
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

  const cuerpo: Record<EstadoOrden, string> = {
    recibido: `Recibimos tu ${equipo} en ${taller}. Tu número de orden es ${d.numeroOrden}.`,
    en_diagnostico: `Estamos revisando tu ${equipo} (orden ${d.numeroOrden}). Te avisamos apenas tengamos el diagnóstico.`,
    presupuestado: monto
      ? `El presupuesto para reparar tu ${equipo} (orden ${d.numeroOrden}) es de ${monto}. ¿Lo aprobás? Respondé este mensaje y seguimos.`
      : `Ya tenemos el presupuesto para tu ${equipo} (orden ${d.numeroOrden}). ¿Te lo pasamos?`,
    aprobado: `Gracias por aprobar el presupuesto. Ya empezamos con la reparación de tu ${equipo} (orden ${d.numeroOrden}).`,
    rechazado: `Registramos que no vas a seguir con la reparación de tu ${equipo} (orden ${d.numeroOrden}). Podés pasar a retirarlo por ${lugar}.`,
    en_reparacion: `Estamos reparando tu ${equipo} (orden ${d.numeroOrden}). Te avisamos cuando esté listo.`,
    listo_para_retirar: `¡Tu ${equipo} ya está listo para retirar! Te esperamos en ${lugar}. Orden ${d.numeroOrden}${monto ? `, total ${monto}` : ''}.`,
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
    moneda: orden.moneda,
    clienteNombre: orden.cliente?.nombre,
    clienteTelefono: orden.cliente?.telefono,
    marca: orden.equipo?.marca,
    modelo: orden.equipo?.modelo,
    sucursal: orden.sucursal
  };
}
