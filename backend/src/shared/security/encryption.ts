import { env } from '../../config/env';
import { cifrar, claveDesdeHex, descifrar } from './aes-gcm';

/**
 * Cifrado de datos sensibles con la clave del entorno (ENCRYPTION_KEY).
 *
 * Se usa para la clave de desbloqueo y las credenciales de cuentas de los
 * equipos (texto) y para la firma del cliente (binario).
 */

const clave = claveDesdeHex(env.encryptionKey);

/** Lo que se muestra en lugar de un dato sensible que no se pidió revelar. */
export const MASCARA = '••••••••';

/** Cifra un texto; vacío o ausente se guarda como null. */
export function encryptNullable(valor?: string | null): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  return cifrar(Buffer.from(valor, 'utf8'), clave, 'hex');
}

/** Descifra un texto. Devuelve null si no hay dato o si está corrupto. */
export function decryptNullable(valor?: string | null): string | null {
  if (!valor) return null;
  try {
    return descifrar(valor, clave, 'hex').toString('utf8');
  } catch {
    return null;
  }
}

/** Cifra un binario (la firma del cliente). */
export function encryptBuffer(buffer: Buffer): string {
  return cifrar(buffer, clave, 'base64');
}

/** Descifra un binario. Devuelve null si no hay dato o si está corrupto. */
export function decryptBuffer(payload?: string | null): Buffer | null {
  if (!payload) return null;
  try {
    return descifrar(payload, clave, 'base64');
  } catch {
    return null;
  }
}
