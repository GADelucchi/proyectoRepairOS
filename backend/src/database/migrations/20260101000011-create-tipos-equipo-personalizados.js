'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tabla para tipos de equipo personalizados
    await queryInterface.createTable('tipo_equipo_personalizados', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: Sequelize.STRING(255), allowNull: false },
      usuario_id: { type: Sequelize.INTEGER, allowNull: false },
      sucursal_id: { type: Sequelize.INTEGER, allowNull: false },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    // Índices para búsquedas rápidas
    await queryInterface.addIndex('tipo_equipo_personalizados', ['usuario_id', 'sucursal_id']);
    await queryInterface.addIndex('tipo_equipo_personalizados', ['activo']);

    // Tabla para chequeos personalizados
    await queryInterface.createTable('chequeo_personalizados', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tipo_equipo_personalizado_id: { type: Sequelize.INTEGER, allowNull: false },
      texto: { type: Sequelize.TEXT, allowNull: false },
      opciones: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [{ etiqueta: 'Sí' }, { etiqueta: 'No' }, { etiqueta: 'Sin revisar' }]
      },
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    // Índice para búsquedas rápidas
    await queryInterface.addIndex('chequeo_personalizados', ['tipo_equipo_personalizado_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chequeo_personalizados');
    await queryInterface.dropTable('tipo_equipo_personalizados');
  }
};
