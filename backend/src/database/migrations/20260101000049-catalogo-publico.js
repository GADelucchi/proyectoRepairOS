'use strict';

const { agregarColumna } = require('../migraciones-seguras');

/**
 * Catálogo público del stock: con `catalogo_publico` encendido, cualquiera con
 * el código público del taller ve los equipos disponibles y su precio de venta
 * (`GET /api/catalogo/:codigo`). Arranca apagado: publicar el stock lo decide
 * cada taller.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await agregarColumna(queryInterface, 'talleres', 'catalogo_publico', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('talleres', 'catalogo_publico');
  }
};
