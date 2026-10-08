import { Op } from 'sequelize';
import { env } from '../../config/env';
import { User } from '../../models';
import { DatosNotificacion, notificarEnLaApp } from '../notificaciones/notificaciones.service';

/**
 * Administración de la plataforma: quien ve y gestiona todos los talleres.
 *
 * No es un rol de la base sino una lista de emails en la configuración
 * (`PLATFORM_ADMIN_EMAILS`). Así la misma persona puede tener su propio taller
 * con una cuenta normal y, además, administrar el sistema; y nadie puede
 * ganarse el permiso editando usuarios desde la app.
 */
export function esAdminDePlataforma(email: string): boolean {
  return env.plataforma.adminEmails.includes(email.toLowerCase());
}

/**
 * Avisa en la campanita a quienes administran la plataforma. `exceptoId` es
 * quien hizo la acción: no hace falta avisarle lo que acaba de hacer.
 */
export async function notificarAdminsDePlataforma(
  datos: DatosNotificacion,
  exceptoId?: number
): Promise<void> {
  if (env.plataforma.adminEmails.length === 0) return;
  const admins = await User.findAll({
    where: {
      email: { [Op.in]: env.plataforma.adminEmails },
      activo: true,
      ...(exceptoId ? { id: { [Op.ne]: exceptoId } } : {})
    },
    attributes: ['id']
  });
  await notificarEnLaApp(
    admins.map((a) => a.id),
    datos
  );
}
