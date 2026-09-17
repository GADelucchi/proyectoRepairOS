'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('clientes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: Sequelize.STRING(100), allowNull: false },
      apellido: { type: Sequelize.STRING(100), allowNull: false },
      dni_cuit: { type: Sequelize.STRING(20), allowNull: true },
      telefono: { type: Sequelize.STRING(50), allowNull: true },
      email: { type: Sequelize.STRING(150), allowNull: true },
      fecha_nacimiento: { type: Sequelize.DATEONLY, allowNull: true },
      direccion: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('clientes', ['dni_cuit']);
    await queryInterface.addIndex('clientes', ['nombre', 'apellido']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('clientes');
  }
};
