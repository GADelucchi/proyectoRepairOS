'use strict';

const { borrarDemo, crearDemo, DEMO_EMAIL, DEMO_PASSWORD } = require('../demo/demo-publico');

/**
 * Taller de demostración pública, para que cualquiera pueda entrar a probar el
 * sistema sin registrarse y sin ver datos de talleres reales.
 *
 * Los datos viven en `demo/demo-publico.js` porque `scripts/reset-demo.js` los reutiliza
 * para rehacer la demo periódicamente.
 *
 * Es idempotente: borra el taller demo si ya estaba y lo vuelve a crear, así
 * que correrlo de nuevo equivale a resetear la demo.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await borrarDemo(queryInterface);
    const resumen = await crearDemo(queryInterface);
    console.log(
      '  → Taller demo listo: ' +
        resumen.clientes +
        ' clientes, ' +
        resumen.equipos +
        ' equipos, ' +
        resumen.ordenes +
        ' órdenes.'
    );
    console.log('  → Acceso: ' + DEMO_EMAIL + ' / ' + DEMO_PASSWORD);
  },

  async down(queryInterface) {
    await borrarDemo(queryInterface);
  }
};
