'use strict';

const { agregarColumna } = require('../migraciones-seguras');

/**
 * Detalles para el cliente de un equipo del stock ("rayón leve en el marco, con
 * caja y cargador"): se ven en el catálogo público.
 *
 * Van aparte de `observaciones`, que siguen siendo notas internas del taller
 * (ahí queda, por ejemplo, en qué venta entró como parte de pago). Lo ya
 * cargado en observaciones no se publica.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await agregarColumna(queryInterface, 'equipos_stock', 'detalles', {
      type: Sequelize.STRING(500),
      allowNull: true,
      after: 'precio'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('equipos_stock', 'detalles');
  }
};
