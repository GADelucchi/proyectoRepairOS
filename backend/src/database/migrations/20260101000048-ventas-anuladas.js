'use strict';

/**
 * Una venta completada se puede anular: un error de carga o un cliente que
 * devuelve lo que compró. Tampoco se borra: queda `anulada`, con quién, cuándo y
 * por qué en las mismas columnas que una cancelada. Redefinir el ENUM se puede
 * correr de nuevo sin problema.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ventas', 'estado', {
      type: Sequelize.ENUM('reservada', 'senada', 'completada', 'cancelada', 'vencida', 'anulada'),
      allowNull: false
    });
  },

  // Una anulada vuelve a quedar como cancelada: sigue sin contar en el informe.
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query("UPDATE ventas SET estado = 'cancelada' WHERE estado = 'anulada'");
    await queryInterface.changeColumn('ventas', 'estado', {
      type: Sequelize.ENUM('reservada', 'senada', 'completada', 'cancelada', 'vencida'),
      allowNull: false
    });
  }
};
