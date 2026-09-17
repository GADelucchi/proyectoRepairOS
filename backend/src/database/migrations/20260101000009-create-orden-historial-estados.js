'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orden_historial_estados', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      orden_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ordenes', key: 'id' },
        onDelete: 'CASCADE'
      },
      estado_anterior: { type: Sequelize.STRING(30), allowNull: true },
      estado_nuevo: { type: Sequelize.STRING(30), allowNull: false },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT'
      },
      comentario: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('orden_historial_estados');
  }
};
