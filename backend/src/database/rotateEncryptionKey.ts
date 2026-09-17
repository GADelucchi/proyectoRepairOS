import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

/**
 * Re-cifra los datos sensibles al cambiar ENCRYPTION_KEY.
 *
 * Los campos cifrados (clave de desbloqueo y credenciales de cuentas de equipos)
 * están guardados como "iv:authTag:cipherText" con AES-256-GCM. Si se cambia la
 * clave sin re-cifrar, esos datos quedan irrecuperables.
 *
 * Uso:
 *   OLD_ENCRYPTION_KEY=<hex64 vieja> NEW_ENCRYPTION_KEY=<hex64 nueva> npm run keys:rotate
 *
 * El script no toca el .env: una vez que termina OK, reemplazá ENCRYPTION_KEY
 * por el valor de NEW_ENCRYPTION_KEY.
 */

const ALGORITHM = 'aes-256-gcm';
const CAMPOS = ['clave_desbloqueo_enc', 'cuenta_usuario_enc', 'cuenta_password_enc'] as const;

function parseKey(nombre: string): Buffer {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre}`);
  const key = Buffer.from(valor, 'hex');
  if (key.length !== 32) {
    throw new Error(`${nombre} debe ser hexadecimal de 64 caracteres (32 bytes)`);
  }
  return key;
}

function decrypt(payload: string, key: Buffer): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) throw new Error('Formato de dato cifrado inválido');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

function encrypt(plainText: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

async function main(): Promise<void> {
  const oldKey = parseKey('OLD_ENCRYPTION_KEY');
  const newKey = parseKey('NEW_ENCRYPTION_KEY');
  if (oldKey.equals(newKey)) throw new Error('La clave nueva es igual a la vieja, no hay nada que rotar');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME
  });

  let recifrados = 0;
  let fallidos = 0;

  try {
    await connection.beginTransaction();
    const [filas] = await connection.query<any[]>(
      `SELECT id, ${CAMPOS.join(', ')} FROM equipos WHERE ${CAMPOS.map((c) => `${c} IS NOT NULL`).join(' OR ')}`
    );

    for (const fila of filas) {
      const updates: string[] = [];
      const valores: string[] = [];

      for (const campo of CAMPOS) {
        const actual = fila[campo];
        if (!actual) continue;
        try {
          valores.push(encrypt(decrypt(actual, oldKey), newKey));
          updates.push(`${campo} = ?`);
        } catch {
          console.warn(
            `  ! equipo ${fila.id}: no se pudo descifrar "${campo}" con la clave vieja, se deja intacto`
          );
          fallidos++;
        }
      }

      if (updates.length > 0) {
        await connection.execute(`UPDATE equipos SET ${updates.join(', ')} WHERE id = ?`, [
          ...valores,
          fila.id
        ]);
        recifrados++;
      }
    }

    await connection.commit();
    console.log(`\n✔ Equipos re-cifrados: ${recifrados}`);
    if (fallidos > 0) {
      console.log(`⚠ Campos que no se pudieron descifrar: ${fallidos} (quedaron con la clave vieja)`);
    }
    console.log('→ Ahora reemplazá ENCRYPTION_KEY en el .env por el valor de NEW_ENCRYPTION_KEY.');
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('✘ Error rotando la clave de cifrado:', err instanceof Error ? err.message : err);
  process.exit(1);
});
