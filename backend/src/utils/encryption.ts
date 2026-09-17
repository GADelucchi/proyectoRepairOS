import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';

function getKeyBuffer(): Buffer {
  const key = Buffer.from(env.encryptionKey, 'hex');
  if (key.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY debe ser una cadena hexadecimal de 32 bytes (64 caracteres). Generar con crypto.randomBytes(32).toString("hex")'
    );
  }
  return key;
}

/**
 * Cifra un valor sensible (clave de desbloqueo, credenciales de cuentas vinculadas, etc.)
 * usando AES-256-GCM. Devuelve un string "iv:authTag:cipherText" en hexadecimal.
 */
export function encrypt(plainText: string): string {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Descifra un valor previamente cifrado con encrypt().
 */
export function decrypt(payload: string): string {
  const key = getKeyBuffer();
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Formato de dato cifrado inválido');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptNullable(value?: string | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  return encrypt(value);
}

export function decryptNullable(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

/** Enmascara un valor sensible para mostrarlo por defecto en pantalla (sin revelar). */
export function mask(): string {
  return '••••••••';
}
