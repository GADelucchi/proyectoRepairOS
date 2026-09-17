'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      cliente_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
        onDelete: 'CASCADE'
      },
      tipo: {
        type: Sequelize.ENUM('telefono', 'computadora', 'tableta', 'otro'),
        allowNull: false,
        defaultValue: 'otro'
      },
      marca: { type: Sequelize.STRING(100), allowNull: true },
      modelo: { type: Sequelize.STRING(100), allowNull: true },
      color: { type: Sequelize.STRING(50), allowNull: true },
      numero_serie: { type: Sequelize.STRING(150), allowNull: true },
      clave_desbloqueo_enc: { type: Sequelize.TEXT, allowNull: true },
      cuenta_usuario_enc: { type: Sequelize.TEXT, allowNull: true },
      cuenta_password_enc: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('equipos', ['numero_serie']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('equipos');
  }
};
