'use strict';

/**
 * Alinea el esquema con el modelo Equipo.
 *
 * La migración 16 creó `equipos.tipo_equipo_personalizado_id` como NULL-able y con
 * ON DELETE SET NULL, pero el modelo lo declara `allowNull: false`. Las filas
 * anteriores a esa migración quedaron en NULL y el modelo miente sobre ellas.
 *
 * Acá se le asigna a esos equipos huérfanos un tipo "Sin especificar" por sucursal
 * (creado solo si hace falta), se pasa la columna a NOT NULL y se cambia la regla
 * de borrado a RESTRICT: un tipo con equipos asociados ya no se puede eliminar
 * dejando datos rotos.
 *
 * @type {import('sequelize-cli').Migration}
 */
const NOMBRE_FALLBACK = 'Sin especificar';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const transaction = await sequelize.transaction();

    try {
      const [{ huerfanos }] = await sequelize.query(
        'SELECT COUNT(*) AS huerfanos FROM equipos WHERE tipo_equipo_personalizado_id IS NULL',
        { type: sequelize.QueryTypes.SELECT, transaction }
      );

      if (Number(huerfanos) > 0) {
        const sucursales = await sequelize.query('SELECT id FROM sucursales ORDER BY id ASC', {
          type: sequelize.QueryTypes.SELECT,
          transaction
        });

        if (sucursales.length === 0) {
          throw new Error(
            `Hay ${huerfanos} equipos sin tipo y ninguna sucursal donde crear "${NOMBRE_FALLBACK}". Cargá una sucursal antes de migrar.`
          );
        }

        const sucursalId = sucursales[0].id;
        const existente = await sequelize.query(
          'SELECT id FROM tipo_equipo_personalizados WHERE sucursal_id = ? AND nombre = ? LIMIT 1',
          { replacements: [sucursalId, NOMBRE_FALLBACK], type: sequelize.QueryTypes.SELECT, transaction }
        );

        let tipoId;
        if (existente.length > 0) {
          tipoId = existente[0].id;
        } else {
          await sequelize.query(
            `INSERT INTO tipo_equipo_personalizados (nombre, usuario_id, sucursal_id, activo, created_at, updated_at)
             VALUES (?, NULL, ?, true, NOW(), NOW())`,
            { replacements: [NOMBRE_FALLBACK, sucursalId], transaction }
          );
          const [creado] = await sequelize.query(
            'SELECT id FROM tipo_equipo_personalizados WHERE sucursal_id = ? AND nombre = ? LIMIT 1',
            { replacements: [sucursalId, NOMBRE_FALLBACK], type: sequelize.QueryTypes.SELECT, transaction }
          );
          tipoId = creado.id;
        }

        await sequelize.query(
          'UPDATE equipos SET tipo_equipo_personalizado_id = ? WHERE tipo_equipo_personalizado_id IS NULL',
          { replacements: [tipoId], transaction }
        );
      }

      // Recrear la FK con RESTRICT antes de tocar la nulabilidad.
      await queryInterface.removeConstraint('equipos', 'equipos_ibfk_2', { transaction }).catch(async () => {
        const fks = await sequelize.query(
          `SELECT CONSTRAINT_NAME AS nombre
             FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'equipos'
              AND COLUMN_NAME = 'tipo_equipo_personalizado_id'
              AND REFERENCED_TABLE_NAME IS NOT NULL`,
          { type: sequelize.QueryTypes.SELECT, transaction }
        );
        for (const fk of fks) {
          await queryInterface.removeConstraint('equipos', fk.nombre, { transaction });
        }
      });

      await queryInterface.changeColumn(
        'equipos',
        'tipo_equipo_personalizado_id',
        { type: Sequelize.INTEGER, allowNull: false },
        { transaction }
      );

      await queryInterface.addConstraint('equipos', {
        fields: ['tipo_equipo_personalizado_id'],
        type: 'foreign key',
        name: 'fk_equipos_tipo_equipo',
        references: { table: 'tipo_equipo_personalizados', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        transaction
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('equipos', 'fk_equipos_tipo_equipo');
    await queryInterface.changeColumn('equipos', 'tipo_equipo_personalizado_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addConstraint('equipos', {
      fields: ['tipo_equipo_personalizado_id'],
      type: 'foreign key',
      name: 'fk_equipos_tipo_equipo',
      references: { table: 'tipo_equipo_personalizados', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  }
};
