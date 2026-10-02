import { Equipo } from '../../models';
import { MASCARA, decryptNullable, encryptNullable } from '../../shared/security/encryption';

interface CredencialesEnClaro {
  claveDesbloqueo?: string | null;
  cuentaUsuario?: string | null;
  cuentaPassword?: string | null;
}

/**
 * Credenciales cifradas listas para guardar. Solo incluye los campos que
 * vinieron: `undefined` significa "no tocar", `null` o "" significa "borrar".
 */
export function cifrarCredenciales(datos: CredencialesEnClaro) {
  const cifradas: Partial<Pick<Equipo, 'claveDesbloqueoEnc' | 'cuentaUsuarioEnc' | 'cuentaPasswordEnc'>> = {};
  if (datos.claveDesbloqueo !== undefined)
    cifradas.claveDesbloqueoEnc = encryptNullable(datos.claveDesbloqueo);
  if (datos.cuentaUsuario !== undefined) cifradas.cuentaUsuarioEnc = encryptNullable(datos.cuentaUsuario);
  if (datos.cuentaPassword !== undefined) cifradas.cuentaPasswordEnc = encryptNullable(datos.cuentaPassword);
  return cifradas;
}

/**
 * Equipo tal como sale por la API: sin las columnas cifradas y con las
 * credenciales enmascaradas, salvo que se pida revelarlas.
 */
export function serializarEquipo(equipo: Equipo, revelar: boolean) {
  const { claveDesbloqueoEnc, cuentaUsuarioEnc, cuentaPasswordEnc, ...resto } = equipo.get({ plain: true });
  const mostrar = (cifrado: string | null | undefined) =>
    cifrado ? (revelar ? decryptNullable(cifrado) : MASCARA) : null;

  return {
    ...resto,
    claveDesbloqueo: mostrar(claveDesbloqueoEnc),
    cuentaUsuario: mostrar(cuentaUsuarioEnc),
    cuentaPassword: mostrar(cuentaPasswordEnc)
  };
}
