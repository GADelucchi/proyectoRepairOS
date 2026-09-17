'use strict';

/**
 * Taller: el inquilino (tenant) del sistema.
 *
 * Hasta acá la base asumía un único taller: sucursales, clientes, equipos y
 * usuarios eran globales. Al abrir el registro público cada alta crea su propio
 * taller, y todo lo demás pasa a colgar de él.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('talleres', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('talleres');
  }
};
