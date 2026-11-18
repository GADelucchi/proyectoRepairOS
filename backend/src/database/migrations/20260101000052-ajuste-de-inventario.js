'use strict';

const TIPOS_MOVIMIENTO = [
  'entrada',
  'orden',
  'orden_devolucion',
  'perdida',
  'venta',
  'venta_devolucion',
  'equipo_stock',
  'equipo_stock_devolucion',
  'pase_salida',
  'pase_entrada',
  'pase_cancelado',
  'baja'
];

/**
 * Ajuste por conteo: un admin cuenta lo que hay de un producto y el sistema
 * corrige la diferencia. Lo que falta sale de las entradas más viejas; lo que
 * sobra entra como una entrada de origen `ajuste`. Los dos quedan en el
 * historial como movimientos `ajuste`.
 *
 * Al deshacer, los movimientos de ajuste quedan como `baja` (o `entrada` si
 * sumaron) y las entradas de ajuste, como compras.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('inventario_movimientos', 'tipo', {
      type: Sequelize.ENUM(...TIPOS_MOVIMIENTO, 'ajuste'),
      allowNull: false
    });
    await queryInterface.changeColumn('inventario_entradas', 'origen', {
      type: Sequelize.ENUM('compra', 'pase', 'ajuste'),
      allowNull: false,
      defaultValue: 'compra'
    });
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.query(
      "UPDATE inventario_movimientos SET tipo = IF(cantidad > 0, 'entrada', 'baja') WHERE tipo = 'ajuste'"
    );
    await sequelize.query("UPDATE inventario_entradas SET origen = 'compra' WHERE origen = 'ajuste'");
    await queryInterface.changeColumn('inventario_movimientos', 'tipo', {
      type: Sequelize.ENUM(...TIPOS_MOVIMIENTO),
      allowNull: false
    });
    await queryInterface.changeColumn('inventario_entradas', 'origen', {
      type: Sequelize.ENUM('compra', 'pase'),
      allowNull: false,
      defaultValue: 'compra'
    });
  }
};
