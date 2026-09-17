'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Cambiar tipo de ENUM a VARCHAR en la tabla equipos
    await queryInterface.changeColumn('equipos', 'tipo', {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: 'otro'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir a ENUM si es necesario
    await queryInterface.changeColumn('equipos', 'tipo', {
      type: Sequelize.ENUM('telefono', 'computadora', 'tableta', 'otro'),
      allowNull: false,
      defaultValue: 'otro'
    });
  }
};
