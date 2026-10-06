'use strict';

/**
 * Nota interna en cada cambio de estado.
 *
 * El comentario del historial sale impreso en el remito que se lleva el
 * cliente; la nota interna es para el equipo del taller y no se imprime.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orden_historial_estados', 'nota_interna', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orden_historial_estados', 'nota_interna');
  }
};
