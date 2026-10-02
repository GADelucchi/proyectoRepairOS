import crypto from 'crypto';

/**
 * Primitivas AES-256-GCM, sin depender de la configuración del proceso.
 *
 * Las usan el resto de la app (con la clave del .env, ver `encryption.ts`) y el
 * script de rotación de claves, que necesita trabajar con dos claves a la vez.
 *
 * Formato guardado: "iv:authTag:cipherText". Los textos van en hexadecimal; los
 * binarios (la firma del cliente) en base64, porque el hexadecimal duplica el
 * tamaño de una imagen sin aportar nada.
 */

const ALGORITMO = 'aes-256-gcm';
const BYTES_IV = 12;

export type Codificacion = 'hex' | 'base64';

export function claveDesdeHex(hex: string): Buffer {
  const clave = Buffer.from(hex, 'hex');
  if (clave.length !== 32) {
    throw new Error('La clave de cifrado debe ser hexadecimal de 64 caracteres (32 bytes)');
  }
  return clave;
}

export function cifrar(datos: Buffer, clave: Buffer, codificacion: Codificacion): string {
  const iv = crypto.randomBytes(BYTES_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([cipher.update(datos), cipher.final()]);
  return [iv, cipher.getAuthTag(), cifrado].map((parte) => parte.toString(codificacion)).join(':');
}

/** Lanza un error si el dato está corrupto o se cifró con otra clave. */
export function descifrar(payload: string, clave: Buffer, codificacion: Codificacion): Buffer {
  const [iv, authTag, datos] = payload.split(':');
  if (!iv || !authTag || !datos) throw new Error('Formato de dato cifrado inválido');

  const decipher = crypto.createDecipheriv(ALGORITMO, clave, Buffer.from(iv, codificacion));
  decipher.setAuthTag(Buffer.from(authTag, codificacion));
  return Buffer.concat([decipher.update(Buffer.from(datos, codificacion)), decipher.final()]);
}
