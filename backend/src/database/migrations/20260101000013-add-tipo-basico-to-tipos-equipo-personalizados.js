'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tipo_equipo_personalizados', 'tipo_basico', {
      type: Sequelize.ENUM('telefono', 'computadora', 'tableta', 'otro'),
      allowNull: false,
      defaultValue: 'otro'
    });

    // Add index for better query performance
    await queryInterface.addIndex('tipo_equipo_personalizados', ['tipo_basico']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tipo_equipo_personalizados', ['tipo_basico']);
    await queryInterface.removeColumn('tipo_equipo_personalizados', 'tipo_basico');
  }
};
