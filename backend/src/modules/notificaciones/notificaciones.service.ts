import { Cliente, Notificacion, Orden, User } from '../../models';
import type { TipoNotificacion } from '../../models/Notificacion';
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

export interface DatosNotificacion {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje?: string | null;
  link?: string | null;
}

/**
 * Deja un aviso en la campanita de cada usuario indicado.
 *
 * Best-effort: lo que se avisa ya pasó (se registró un taller, se pidió una
 * autorización), y un aviso que no se guarda no puede deshacerlo.
 */
export async function notificarEnLaApp(usuarioIds: number[], datos: DatosNotificacion): Promise<void> {
  if (usuarioIds.length === 0) return;
  try {
    await Notificacion.bulkCreate(
      usuarioIds.map((usuarioId) => ({
        usuarioId,
        tipo: datos.tipo,
        titulo: datos.titulo.slice(0, 150),
        mensaje: datos.mensaje?.slice(0, 500) ?? null,
        link: datos.link ?? null
      }))
    );
  } catch (err) {
    console.error('[notificacion] app:', err);
  }
}

/**
 * Avisa a los admins del taller que hay algo esperando aprobación: en la
 * campanita siempre, y por email si está configurado.
 *
 * Best-effort: el pedido ya quedó visible en Autorizaciones, así que un correo
 * que no sale no puede tumbar la operación del mostrador.
 */
export async function avisarAdmins(tallerId: number, asunto: string, parrafos: string[]): Promise<void> {
  const admins = await User.findAll({
    where: { tallerId, rol: 'admin', activo: true },
    attributes: ['id', 'email']
  });

  await notificarEnLaApp(
    admins.map((admin) => admin.id),
    { tipo: 'autorizacion', titulo: asunto, mensaje: parrafos.join(' '), link: '/autorizaciones' }
  );

  const proveedor = getEmailProvider();
  if (!proveedor.estaConfigurado()) return;
  const html =
    parrafos.map((p) => `<p>${escaparHtml(p)}</p>`).join('') +
    '<p>Entrá a RepairOS, sección Autorizaciones, para aprobarla o rechazarla.</p>';

  await Promise.allSettled(admins.map((admin) => proveedor.send({ to: admin.email, subject: asunto, html })));
}

const LIMITE_LISTADO = 30;

/** Los avisos más recientes del usuario, leídos y no leídos. */
export function listarNotificaciones(usuarioId: number): Promise<Notificacion[]> {
  return Notificacion.findAll({
    where: { usuarioId },
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ],
    limit: LIMITE_LISTADO
  });
}

export function contarNoLeidas(usuarioId: number): Promise<number> {
  return Notificacion.count({ where: { usuarioId, leidaEn: null } });
}

/** Marcar un aviso ajeno no hace nada: el filtro por usuario lo deja afuera. */
export async function marcarLeida(usuarioId: number, id: number): Promise<void> {
  await Notificacion.update({ leidaEn: new Date() }, { where: { id, usuarioId, leidaEn: null } });
}

export async function marcarTodasLeidas(usuarioId: number): Promise<void> {
  await Notificacion.update({ leidaEn: new Date() }, { where: { usuarioId, leidaEn: null } });
}
