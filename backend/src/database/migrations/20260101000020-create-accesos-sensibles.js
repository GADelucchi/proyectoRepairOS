'use strict';

/**
 * Auditoría de accesos a datos sensibles de equipos.
 *
 * Los clientes y equipos son globales del taller (se atienden en cualquier
 * sucursal), así que no se los puede aislar por sucursal. Lo que sí se controla
 * es quién descifra la clave de desbloqueo y las credenciales de las cuentas
 * vinculadas: cada uso de `?reveal=true` queda registrado acá.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accesos_sensibles', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT'
      },
      equipo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'equipos', key: 'id' },
        onDelete: 'CASCADE'
      },
      sucursal_id: { type: Sequelize.INTEGER, allowNull: true },
      ip: { type: Sequelize.STRING(45), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    await queryInterface.addIndex('accesos_sensibles', ['equipo_id']);
    await queryInterface.addIndex('accesos_sensibles', ['usuario_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('accesos_sensibles');
  }
};
