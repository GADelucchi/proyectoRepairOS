'use strict';

/** Ciudad del cliente, aparte del domicilio. @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'ciudad', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'direccion'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'ciudad');
  }
};
