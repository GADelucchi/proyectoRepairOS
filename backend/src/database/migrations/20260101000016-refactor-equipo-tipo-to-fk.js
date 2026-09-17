'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Agregar columna FK a equipos
      await queryInterface.addColumn(
        'equipos',
        'tipo_equipo_personalizado_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'tipo_equipo_personalizados',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        { transaction }
      );

      // 2. Eliminar columna tipoBasico de TipoEquipoPersonalizado
      await queryInterface.removeColumn('tipo_equipo_personalizados', 'tipo_basico', { transaction });

      // 3. Eliminar columna tipo de equipos (ya no la necesitamos)
      await queryInterface.removeColumn('equipos', 'tipo', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Revert: agregar columna tipo
      await queryInterface.addColumn(
        'equipos',
        'tipo',
        {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: 'otro'
        },
        { transaction }
      );

      // Revert: agregar columna tipoBasico
      await queryInterface.addColumn(
        'tipo_equipo_personalizados',
        'tipo_basico',
        {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: 'otro'
        },
        { transaction }
      );

      // Revert: eliminar FK
      await queryInterface.removeColumn('equipos', 'tipo_equipo_personalizado_id', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
