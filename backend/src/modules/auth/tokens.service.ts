import { createHash, randomBytes } from 'crypto';
import { Op, Transaction } from 'sequelize';
import { env } from '../../config/env';
import { getEmailProvider } from '../../integrations/email';
import { TokenUsuario, User } from '../../models';
import type { TipoToken } from '../../models/TokenUsuario';
import { errores } from '../../shared/http/http-error';
import { escaparHtml } from '../../shared/utils/texto';

/**
 * Links de un solo uso que viajan por email: recuperar la contraseña y
 * verificar el email. En la base queda solo el hash del token, así que una
 * copia de la base no sirve para usar los links pendientes.
 */

const DURACION_MS: Record<TipoToken, number> = {
  restablecer_password: 60 * 60 * 1000,
  verificar_email: 7 * 24 * 60 * 60 * 1000
};

const hashDe = (token: string) => createHash('sha256').update(token).digest('hex');

/** Crea un token nuevo y anula los anteriores del mismo tipo: vale solo el último link. */
async function crearToken(usuarioId: number, tipo: TipoToken): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await TokenUsuario.update({ usadoEn: new Date() }, { where: { usuarioId, tipo, usadoEn: null } });
  await TokenUsuario.create({
    usuarioId,
    tipo,
    tokenHash: hashDe(token),
    expiraEn: new Date(Date.now() + DURACION_MS[tipo])
  });
  return token;
}

/**
 * Valida el token y lo marca usado dentro de la transacción (con la fila
 * bloqueada: dos clics en el mismo link no lo usan dos veces).
 */
export async function consumirToken(tipo: TipoToken, token: string, transaction: Transaction): Promise<User> {
  const registro = await TokenUsuario.findOne({
    where: { tokenHash: hashDe(token), tipo, usadoEn: null, expiraEn: { [Op.gt]: new Date() } },
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (!registro) throw errores.solicitudInvalida('El link no es válido o ya venció. Pedí uno nuevo.');

  const usuario = await User.findByPk(registro.usuarioId, { transaction });
  if (!usuario?.activo) throw errores.solicitudInvalida('La cuenta no está disponible.');

  await registro.update({ usadoEn: new Date() }, { transaction });
  return usuario;
}

function plantilla(titulo: string, parrafos: string[], boton: { texto: string; url: string }): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; color: #111">
      <h2 style="margin: 0 0 16px">${escaparHtml(titulo)}</h2>
      ${parrafos.map((p) => `<p>${escaparHtml(p)}</p>`).join('')}
      <p style="margin: 24px 0">
        <a href="${boton.url}" style="background: #00c9ff; color: #0a0d12; padding: 12px 20px;
           border-radius: 6px; text-decoration: none; font-weight: bold">${escaparHtml(boton.texto)}</a>
      </p>
      <p style="color: #666; font-size: 12px">Si el botón no funciona, copiá este link: ${boton.url}</p>
    </div>`;
}

/** Si los emails pueden salir. Sin Resend configurado estos flujos no llegan a nadie. */
export const emailHabilitado = () => getEmailProvider().estaConfigurado();

/** Manda el link para elegir una contraseña nueva. Sin email configurado no hace nada. */
export async function enviarRecuperacion(usuario: User): Promise<void> {
  if (!emailHabilitado()) return;
  const token = await crearToken(usuario.id, 'restablecer_password');
  await getEmailProvider().send({
    to: usuario.email,
    subject: 'Recuperá tu contraseña de RepairOS',
    html: plantilla(
      'Recuperá tu contraseña',
      [
        `Hola ${usuario.nombre}, pediste cambiar la contraseña de tu cuenta de RepairOS.`,
        'El link vale por una hora. Si no lo pediste vos, ignorá este email: tu contraseña no cambia.'
      ],
      { texto: 'Elegir una contraseña nueva', url: `${env.appPublicUrl}/restablecer?token=${token}` }
    )
  });
}

/** Manda el link para confirmar el email. Sin email configurado no hace nada. */
export async function enviarVerificacion(usuario: User): Promise<void> {
  if (!emailHabilitado()) return;
  const token = await crearToken(usuario.id, 'verificar_email');
  await getEmailProvider().send({
    to: usuario.email,
    subject: 'Confirmá tu email en RepairOS',
    html: plantilla(
      'Confirmá tu email',
      [
        `Hola ${usuario.nombre}, gracias por registrar tu taller en RepairOS.`,
        'Confirmá que este email es tuyo para activar la cuenta. El link vale por 7 días.'
      ],
      { texto: 'Confirmar mi email', url: `${env.appPublicUrl}/verificar-email?token=${token}` }
    )
  });
}
