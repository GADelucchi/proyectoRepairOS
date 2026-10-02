'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config/config');
const { borrarDemo, crearDemo, DEMO_EMAIL, DEMO_PASSWORD } = require('../demo/demo-publico');

/**
 * Restaura el taller de demostración pública a su estado inicial.
 *
 * Pensado para un cron: la demo se ensucia sola a medida que la gente la prueba
 * (órdenes de relleno, clientes "asdasd"), así que cada tanto conviene borrarla
 * y rehacerla.
 *
 * Es JavaScript plano a propósito: corre con `node` sin compilar y sin ts-node,
 * así el cron no depende del build ni de las devDependencies.
 *
 * Uso:
 *   node src/database/scripts/reset-demo.js
 */

const entorno = process.env.NODE_ENV || 'development';
const cfg = config[entorno] || config.development;

async function main() {
  const sequelize = new Sequelize(cfg.database, cfg.username, cfg.password, cfg);

  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();

    const existia = await borrarDemo(queryInterface);
    console.log(existia ? '→ Demo anterior borrada.' : '→ No había demo previa.');

    const resumen = await crearDemo(queryInterface);
    console.log(
      '✔ Demo restaurada: ' +
        resumen.clientes +
        ' clientes, ' +
        resumen.equipos +
        ' equipos, ' +
        resumen.ordenes +
        ' órdenes.'
    );
    console.log('  Acceso: ' + DEMO_EMAIL + ' / ' + DEMO_PASSWORD);
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error('✘ No se pudo restaurar la demo:', err.message);
  process.exit(1);
});
