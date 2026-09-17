import { getEmailProvider } from './email';
import { getWhatsAppProvider } from './whatsapp';
import { Cliente } from '../models/Cliente';
import { Orden, EstadoOrden } from '../models/Orden';

const ETIQUETAS_ESTADO: Record<EstadoOrden, string> = {
  recibido: 'Recibido',
  en_diagnostico: 'En diagnóstico',
  presupuestado: 'Presupuestado',
  aprobado: 'Aprobado por el cliente',
  rechazado: 'Rechazado por el cliente',
  en_reparacion: 'En reparación',
  listo_para_retirar: 'Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

export function etiquetaEstado(estado: EstadoOrden): string {
  return ETIQUETAS_ESTADO[estado] ?? estado;
}

/** Qué pasó realmente al intentar avisarle al cliente. */
export interface ResultadoNotificacion {
  email: 'enviado' | 'sin_direccion' | 'no_configurado' | 'error';
  whatsapp: 'enviado' | 'sin_telefono' | 'no_configurado' | 'error';
  /** Mensaje listo para mostrar en pantalla. */
  detalle: string;
}

function describir(resultado: Omit<ResultadoNotificacion, 'detalle'>, cliente: Cliente): string {
  if (resultado.email === 'enviado') return `Se le envió un email a ${cliente.email}.`;
  if (resultado.email === 'sin_direccion') return 'El cliente no tiene email cargado, no se le avisó.';
  if (resultado.email === 'no_configurado') return 'El envío de emails no está configurado, no se le avisó.';
  return 'No se pudo enviar el aviso al cliente.';
}

/**
 * Notifica al cliente un cambio de estado y devuelve qué ocurrió.
 *
 * Devuelve el resultado en lugar de fallar en silencio: antes esto era
 * fire-and-forget y la pantalla afirmaba "Se notificó al cliente" incluso sin
 * proveedor de email configurado o sin dirección cargada.
 */
export async function notificarCambioEstadoOrden(
  orden: Orden,
  cliente: Cliente
): Promise<ResultadoNotificacion> {
  const estadoTexto = etiquetaEstado(orden.estado);
  const parcial: Omit<ResultadoNotificacion, 'detalle'> = {
    email: 'sin_direccion',
    whatsapp: 'sin_telefono'
  };

  if (cliente.email) {
    const proveedor = getEmailProvider();
    if (!proveedor.estaConfigurado()) {
      parcial.email = 'no_configurado';
    } else {
      try {
        await proveedor.send({
          to: cliente.email,
          subject: `Actualización de tu orden ${orden.numeroOrden}`,
          html: `
        <p>Hola ${cliente.nombre},</p>
        <p>El estado de tu orden <strong>${orden.numeroOrden}</strong> cambió a: <strong>${estadoTexto}</strong>.</p>
        <p>Ante cualquier consulta, contactanos respondiendo este email.</p>
      `
        });
        parcial.email = 'enviado';
      } catch (err) {
        console.error('[notificacion] email:', err);
        parcial.email = 'error';
      }
    }
  }

  if (cliente.telefono) {
    const proveedor = getWhatsAppProvider();
    if (!proveedor.estaConfigurado()) {
      parcial.whatsapp = 'no_configurado';
    } else {
      try {
        await proveedor.send({
          to: cliente.telefono,
          body: `Tu orden ${orden.numeroOrden} cambió de estado a: ${estadoTexto}.`
        });
        parcial.whatsapp = 'enviado';
      } catch (err) {
        console.error('[notificacion] whatsapp:', err);
        parcial.whatsapp = 'error';
      }
    }
  }

  return { ...parcial, detalle: describir(parcial, cliente) };
}
