import { Cliente, Orden, User } from '../../models';
import { getEmailProvider } from '../../integrations/email';
import { getWhatsAppProvider } from '../../integrations/whatsapp';
import { escaparHtml } from '../../shared/utils/texto';
import { etiquetaEstado } from '../ordenes/estado-orden';

/** Qué pasó realmente al intentar avisarle al cliente. */
export interface ResultadoNotificacion {
  email: 'enviado' | 'sin_direccion' | 'no_configurado' | 'error';
  whatsapp: 'enviado' | 'sin_telefono' | 'no_configurado' | 'error';
  /** Mensaje listo para mostrar en pantalla. */
  detalle: string;
}

type Canales = Omit<ResultadoNotificacion, 'detalle'>;

function describir(canales: Canales, cliente: Cliente): string {
  switch (canales.email) {
    case 'enviado':
      return `Se le envió un email a ${cliente.email}.`;
    case 'sin_direccion':
      return 'El cliente no tiene email cargado, no se le avisó.';
    case 'no_configurado':
      return 'El envío de emails no está configurado, no se le avisó.';
    default:
      return 'No se pudo enviar el aviso al cliente.';
  }
}

async function avisarPorEmail(orden: Orden, cliente: Cliente): Promise<Canales['email']> {
  if (!cliente.email) return 'sin_direccion';
  const proveedor = getEmailProvider();
  if (!proveedor.estaConfigurado()) return 'no_configurado';

  try {
    await proveedor.send({
      to: cliente.email,
      subject: `Actualización de tu orden ${orden.numeroOrden}`,
      html: `
        <p>Hola ${escaparHtml(cliente.nombre)},</p>
        <p>El estado de tu orden <strong>${escaparHtml(orden.numeroOrden)}</strong> cambió a:
           <strong>${escaparHtml(etiquetaEstado(orden.estado))}</strong>.</p>
        <p>Ante cualquier consulta, contactanos respondiendo este email.</p>`
    });
    return 'enviado';
  } catch (err) {
    console.error('[notificacion] email:', err);
    return 'error';
  }
}

async function avisarPorWhatsApp(orden: Orden, cliente: Cliente): Promise<Canales['whatsapp']> {
  if (!cliente.telefono) return 'sin_telefono';
  const proveedor = getWhatsAppProvider();
  if (!proveedor.estaConfigurado()) return 'no_configurado';

  try {
    await proveedor.send({
      to: cliente.telefono,
      body: `Tu orden ${orden.numeroOrden} cambió de estado a: ${etiquetaEstado(orden.estado)}.`
    });
    return 'enviado';
  } catch (err) {
    console.error('[notificacion] whatsapp:', err);
    return 'error';
  }
}

/**
 * Avisa al cliente un cambio de estado y devuelve qué ocurrió en cada canal.
 *
 * Nunca lanza: la orden ya cambió de estado, y un aviso que falla se informa
 * en pantalla en vez de revertir la operación.
 */
export async function notificarCambioEstadoOrden(
  orden: Orden,
  cliente: Cliente
): Promise<ResultadoNotificacion> {
  const canales: Canales = {
    email: await avisarPorEmail(orden, cliente),
    whatsapp: await avisarPorWhatsApp(orden, cliente)
  };
  return { ...canales, detalle: describir(canales, cliente) };
}

/**
 * Avisa a los admins del taller que hay algo esperando aprobación.
 *
 * Best-effort: el pedido ya quedó visible en Autorizaciones, así que un correo
 * que no sale no puede tumbar la operación del mostrador.
 */
export async function avisarAdmins(tallerId: number, asunto: string, parrafos: string[]): Promise<void> {
  const proveedor = getEmailProvider();
  if (!proveedor.estaConfigurado()) return;

  const admins = await User.findAll({
    where: { tallerId, rol: 'admin', activo: true },
    attributes: ['email']
  });
  const html =
    parrafos.map((p) => `<p>${escaparHtml(p)}</p>`).join('') +
    '<p>Entrá a RepairOS, sección Autorizaciones, para aprobarla o rechazarla.</p>';

  await Promise.allSettled(admins.map((admin) => proveedor.send({ to: admin.email, subject: asunto, html })));
}
