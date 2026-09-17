'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Cambiar tipo_basico de ENUM a VARCHAR
    await queryInterface.changeColumn('tipo_equipo_personalizados', 'tipo_basico', {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: 'otro'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revertir a ENUM si es necesario
    await queryInterface.changeColumn('tipo_equipo_personalizados', 'tipo_basico', {
      type: Sequelize.ENUM('telefono', 'computadora', 'tableta', 'otro'),
      allowNull: false,
      defaultValue: 'otro'
    });
  }
};
