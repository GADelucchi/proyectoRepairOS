import 'dotenv/config';
import { execSync } from 'child_process';
import mysql from 'mysql2/promise';
import { BASE_DE_TESTS } from './base';

/**
 * Antes de la corrida: borra `repairos_test`, la crea de nuevo y aplica todas
 * las migraciones. Así cada corrida arranca de cero y además prueba que las
 * migraciones funcionan desde una base vacía.
 */
export default async function prepararBase(): Promise<void> {
  // No se toma de DB_NAME: el globalSetup corre con el .env de desarrollo cargado.
  const nombre = BASE_DE_TESTS;

  const conexion = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });
  await conexion.query(`DROP DATABASE IF EXISTS \`${nombre}\``);
  await conexion.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conexion.end();

  execSync('npx sequelize-cli db:migrate --env development', {
    stdio: 'pipe',
    env: { ...process.env, DB_NAME: nombre }
  });
}
