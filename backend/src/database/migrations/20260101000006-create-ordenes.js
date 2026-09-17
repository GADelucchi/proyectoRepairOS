'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ordenes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      numero_orden: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      cliente_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
        onDelete: 'RESTRICT'
      },
      equipo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'equipos', key: 'id' },
        onDelete: 'RESTRICT'
      },
      sucursal_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'sucursales', key: 'id' },
        onDelete: 'RESTRICT'
      },
      tecnico_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT'
      },
      estado: {
        type: Sequelize.ENUM(
          'recibido',
          'en_diagnostico',
          'presupuestado',
          'aprobado',
          'rechazado',
          'en_reparacion',
          'listo_para_retirar',
          'entregado',
          'cancelado'
        ),
        allowNull: false,
        defaultValue: 'recibido'
      },
      fecha_ingreso: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      fecha_pactada: { type: Sequelize.DATEONLY, allowNull: true },
      detalles_esteticos: { type: Sequelize.TEXT, allowNull: true },
      reparacion_solicitada: { type: Sequelize.TEXT, allowNull: true },
      notas_internas: { type: Sequelize.TEXT, allowNull: true },
      presupuesto_monto: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      presupuesto_aprobado: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: null },
      firma_cliente_url: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('ordenes', ['sucursal_id']);
    await queryInterface.addIndex('ordenes', ['estado']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ordenes');
  }
};
