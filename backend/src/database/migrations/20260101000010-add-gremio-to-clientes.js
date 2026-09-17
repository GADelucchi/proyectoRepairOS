'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('clientes', 'es_gremio', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
    await queryInterface.addColumn('clientes', 'nombre_gremio', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'es_gremio');
    await queryInterface.removeColumn('clientes', 'nombre_gremio');
  }
};
