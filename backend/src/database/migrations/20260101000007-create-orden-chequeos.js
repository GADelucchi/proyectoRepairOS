'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orden_chequeos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      orden_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ordenes', key: 'id' },
        onDelete: 'CASCADE'
      },
      item: { type: Sequelize.STRING(150), allowNull: false },
      resultado: { type: Sequelize.ENUM('si', 'no', 'na'), allowNull: true, defaultValue: null },
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('orden_chequeos');
  }
};
