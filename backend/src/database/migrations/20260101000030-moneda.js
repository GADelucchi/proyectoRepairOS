'use strict';

/**
 * Moneda de cada orden y de cada asiento de la cuenta corriente.
 *
 * Una orden se presupuesta y se cobra en una sola moneda, y los movimientos que
 * genera la heredan. Los saldos se calculan por moneda: sumar pesos con dólares
 * daría un número que no representa ninguna deuda real. Lo existente queda en
 * pesos argentinos, que era la única moneda hasta ahora.
 *
 * @type {import('sequelize-cli').Migration}
 */
const TABLAS = ['ordenes', 'cuenta_movimientos', 'solicitudes'];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const tabla of TABLAS) {
      await queryInterface.addColumn(tabla, 'moneda', {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'ARS'
      });
    }
    await queryInterface.addIndex('cuenta_movimientos', ['taller_id', 'cliente_id', 'moneda'], {
      name: 'idx_cuenta_movimientos_cliente_moneda'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('cuenta_movimientos', 'idx_cuenta_movimientos_cliente_moneda');
    for (const tabla of TABLAS) {
      await queryInterface.removeColumn(tabla, 'moneda');
    }
  }
};
