import 'dotenv/config';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { cifrar, claveDesdeHex, Codificacion, descifrar } from '../../shared/security/aes-gcm';

/**
 * Re-cifra los datos sensibles al cambiar ENCRYPTION_KEY.
 *
 * Si se cambia la clave sin re-cifrar, las credenciales de los equipos y las
 * firmas de los clientes quedan irrecuperables.
 *
 * Uso:
 *   OLD_ENCRYPTION_KEY=<hex64 vieja> NEW_ENCRYPTION_KEY=<hex64 nueva> npm run keys:rotate
 *
 * El script no toca el .env: cuando termina OK, reemplazá ENCRYPTION_KEY por el
 * valor de NEW_ENCRYPTION_KEY.
 */

interface ColumnaCifrada {
  tabla: string;
  columna: string;
  codificacion: Codificacion;
}

const COLUMNAS: ColumnaCifrada[] = [
  { tabla: 'equipos', columna: 'clave_desbloqueo_enc', codificacion: 'hex' },
  { tabla: 'equipos', columna: 'cuenta_usuario_enc', codificacion: 'hex' },
  { tabla: 'equipos', columna: 'cuenta_password_enc', codificacion: 'hex' },
  { tabla: 'ordenes', columna: 'firma_cliente_enc', codificacion: 'base64' }
];

function claveDeVariable(nombre: string): Buffer {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre}`);
  return claveDesdeHex(valor);
}

async function main(): Promise<void> {
  const claveVieja = claveDeVariable('OLD_ENCRYPTION_KEY');
  const claveNueva = claveDeVariable('NEW_ENCRYPTION_KEY');
  if (claveVieja.equals(claveNueva))
    throw new Error('La clave nueva es igual a la vieja, no hay nada que rotar');

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME
  });

  let recifrados = 0;
  let fallidos = 0;

  try {
    await conexion.beginTransaction();

    for (const { tabla, columna, codificacion } of COLUMNAS) {
      const [filas] = await conexion.query<RowDataPacket[]>(
        `SELECT id, ${columna} AS valor FROM ${tabla} WHERE ${columna} IS NOT NULL`
      );

      for (const fila of filas) {
        try {
          const plano = descifrar(fila.valor, claveVieja, codificacion);
          await conexion.execute(`UPDATE ${tabla} SET ${columna} = ? WHERE id = ?`, [
            cifrar(plano, claveNueva, codificacion),
            fila.id
          ]);
          recifrados++;
        } catch {
          console.warn(`  ! ${tabla} ${fila.id}: no se pudo descifrar "${columna}", se deja intacto`);
          fallidos++;
        }
      }
    }

    await conexion.commit();
    console.log(`\n✔ Valores re-cifrados: ${recifrados}`);
    if (fallidos > 0) console.log(`⚠ No se pudieron descifrar: ${fallidos} (quedaron con la clave vieja)`);
    console.log('→ Ahora reemplazá ENCRYPTION_KEY en el .env por el valor de NEW_ENCRYPTION_KEY.');
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    await conexion.end();
  }
}

main().catch((err) => {
  console.error('✘ Error rotando la clave de cifrado:', err instanceof Error ? err.message : err);
  process.exit(1);
});
