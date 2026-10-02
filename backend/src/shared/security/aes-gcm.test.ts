import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { cifrar, claveDesdeHex, descifrar } from './aes-gcm';

const clave = claveDesdeHex('ab'.repeat(32));

describe('aes-gcm', () => {
  it('descifra lo que cifra, en hex y en base64', () => {
    for (const codificacion of ['hex', 'base64'] as const) {
      const cifrado = cifrar(Buffer.from('1234'), clave, codificacion);
      expect(descifrar(cifrado, clave, codificacion).toString()).toBe('1234');
    }
  });

  it('rechaza un dato cifrado con otra clave', () => {
    const cifrado = cifrar(Buffer.from('secreto'), clave, 'hex');
    expect(() => descifrar(cifrado, claveDesdeHex('cd'.repeat(32)), 'hex')).toThrow();
  });

  it('lee el formato que guardaba la versión anterior', () => {
    // Mismo esquema que el `encrypt` original: iv:authTag:cipherText en hex.
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
    const datos = Buffer.concat([cipher.update('clave-vieja', 'utf8'), cipher.final()]);
    const guardado = `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${datos.toString('hex')}`;

    expect(descifrar(guardado, clave, 'hex').toString('utf8')).toBe('clave-vieja');
  });

  it('exige una clave de 32 bytes', () => {
    expect(() => claveDesdeHex('abcd')).toThrow();
  });
});
