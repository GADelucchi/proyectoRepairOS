import 'dotenv/config';
import mysql from 'mysql2/promise';
import { execSync } from 'child_process';

/**
 * Script de inicialización de la base de datos.
 *
 * 1. Se conecta al servidor MySQL (sin seleccionar base de datos) y crea la
 *    base indicada en DB_NAME si todavía no existe.
 * 2. Ejecuta todas las migraciones de Sequelize, que crean las tablas y
 *    columnas del sistema (usuarios, sucursales, clientes, equipos, órdenes, etc).
 * 3. Opcionalmente carga los datos iniciales (usuario admin + sucursal) si se
 *    invoca con el flag --seed.
 *
 * Uso:
 *   npm run db:init          -> crea la base y las tablas
 *   npm run db:init:seed     -> crea la base, las tablas y los datos iniciales
 */

async function crearBaseSiNoExiste(): Promise<void> {
  const dbName = process.env.DB_NAME;
  if (!dbName) {
    throw new Error('La variable DB_NAME no está definida. Revisá tu archivo .env');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    console.log(`✔ Base de datos "${dbName}" verificada/creada correctamente.`);
  } finally {
    await connection.end();
  }
}

function ejecutarMigraciones(): void {
  console.log('→ Ejecutando migraciones (creación de tablas y columnas)...');
  execSync('npx sequelize-cli db:migrate', { stdio: 'inherit', cwd: process.cwd() });
}

function ejecutarSeeders(): void {
  console.log('→ Cargando datos iniciales (usuario admin + sucursal)...');
  execSync('npx sequelize-cli db:seed:all', { stdio: 'inherit', cwd: process.cwd() });
}

async function main(): Promise<void> {
  const conSeed = process.argv.includes('--seed') || process.argv.includes('-s');

  await crearBaseSiNoExiste();
  ejecutarMigraciones();

  if (conSeed) {
    ejecutarSeeders();
  }

  console.log('✔ Base de datos lista para usar.');
}

main().catch((err) => {
  console.error('✘ Error al inicializar la base de datos:', err instanceof Error ? err.message : err);
  process.exit(1);
});
