'use strict';

/**
 * Avisos dentro de la app (la campanita) y último acceso de cada usuario.
 *
 * El último acceso es lo que permite a la administración de la plataforma ver
 * qué talleres usan el sistema de verdad y cuáles se registraron y no volvieron.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notificaciones', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tipo: { type: Sequelize.STRING(40), allowNull: false },
      titulo: { type: Sequelize.STRING(150), allowNull: false },
      mensaje: { type: Sequelize.STRING(500), allowNull: true },
      link: { type: Sequelize.STRING(255), allowNull: true },
      leida_en: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    // La campanita pregunta cada minuto cuántas no leídas tiene el usuario.
    await queryInterface.addIndex('notificaciones', ['usuario_id', 'leida_en'], {
      name: 'idx_notificaciones_usuario_leida'
    });

    await queryInterface.addColumn('users', 'ultimo_acceso_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'ultimo_acceso_at');
    await queryInterface.dropTable('notificaciones');
  }
};
