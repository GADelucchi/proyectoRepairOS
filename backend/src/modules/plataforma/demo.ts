import { env } from '../../config/env';
import { User } from '../../models';

/**
 * Id del taller de demo pública, o null si no hay.
 *
 * Se lo reconoce por el email de su admin (`DEMO_EMAIL`), igual que en el login.
 */
export async function idTallerDemo(): Promise<number | null> {
  if (!env.plataforma.demoEmail) return null;
  const usuario = await User.findOne({
    where: { email: env.plataforma.demoEmail },
    attributes: ['tallerId']
  });
  return usuario?.tallerId ?? null;
}
