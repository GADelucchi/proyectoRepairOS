'use strict';

/**
 * Detalle del presupuesto para el cliente: qué se va a hacer y qué incluye el
 * precio. Lo ve en el seguimiento, en el aviso y en el remito; las notas
 * internas siguen siendo solo del taller.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ordenes', 'presupuesto_detalle', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ordenes', 'presupuesto_detalle');
  }
};
