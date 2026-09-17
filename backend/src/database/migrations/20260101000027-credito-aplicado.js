'use strict';

/**
 * Cuánto saldo a favor se usó al entregar.
 *
 * El crédito ya vive en el libro de movimientos —es un saldo negativo—, así que
 * aplicarlo no necesita asientos nuevos: el cargo de la entrega simplemente lo
 * consume. Pero sin esta columna la orden no puede explicar por qué se cobró
 * menos que el total, y tanto la pantalla como el remito dirían que el cliente
 * quedó debiendo una diferencia que en realidad ya estaba paga.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ordenes', 'credito_aplicado', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('ordenes', 'credito_aplicado');
  }
};
