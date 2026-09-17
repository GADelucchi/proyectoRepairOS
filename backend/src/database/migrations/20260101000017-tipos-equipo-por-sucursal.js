'use strict';

/**
 * Los tipos de equipo pasan de ser "de cada usuario" a ser "de cada sucursal".
 *
 * Antes cada técnico veía únicamente los tipos que él mismo había creado, así que
 * una orden cargada por un técnico mostraba el equipo como "Desconocido" en la
 * pantalla de cualquier otro. A partir de acá el tipo pertenece a la sucursal y
 * `usuario_id` queda solo como registro de quién lo creó (puede ser NULL si ese
 * usuario se borra).
 *
 * Como al unificar pueden aparecer nombres repetidos dentro de una misma sucursal
 * (dos técnicos que crearon "iPhone" por separado), se fusionan: se conserva el
 * más antiguo, se le reapuntan los equipos de los duplicados y estos se eliminan.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const transaction = await sequelize.transaction();

    try {
      // 1. usuario_id pasa a ser opcional (autoría, no propiedad).
      await queryInterface.changeColumn(
        'tipo_equipo_personalizados',
        'usuario_id',
        { type: Sequelize.INTEGER, allowNull: true },
        { transaction }
      );

      // 2. Fusionar duplicados por (sucursal, nombre normalizado).
      const duplicados = await sequelize.query(
        `SELECT MIN(id) AS canonico, GROUP_CONCAT(id) AS ids
           FROM tipo_equipo_personalizados
          GROUP BY sucursal_id, LOWER(TRIM(nombre))
         HAVING COUNT(*) > 1`,
        { type: sequelize.QueryTypes.SELECT, transaction }
      );

      for (const grupo of duplicados) {
        const canonico = Number(grupo.canonico);
        const sobrantes = String(grupo.ids)
          .split(',')
          .map(Number)
          .filter((id) => id !== canonico);

        if (sobrantes.length === 0) continue;

        // Los equipos de los duplicados apuntan al tipo que se conserva.
        await sequelize.query(
          'UPDATE equipos SET tipo_equipo_personalizado_id = ? WHERE tipo_equipo_personalizado_id IN (?)',
          { replacements: [canonico, sobrantes], transaction }
        );

        // Si el tipo que se conserva no tiene chequeos, hereda los del primer
        // duplicado que sí tenga; el resto se descarta con el tipo.
        const [{ total }] = await sequelize.query(
          'SELECT COUNT(*) AS total FROM chequeo_personalizados WHERE tipo_equipo_personalizado_id = ?',
          { replacements: [canonico], type: sequelize.QueryTypes.SELECT, transaction }
        );

        if (Number(total) === 0) {
          const donantes = await sequelize.query(
            `SELECT tipo_equipo_personalizado_id AS id
               FROM chequeo_personalizados
              WHERE tipo_equipo_personalizado_id IN (?)
              ORDER BY tipo_equipo_personalizado_id ASC
              LIMIT 1`,
            { replacements: [sobrantes], type: sequelize.QueryTypes.SELECT, transaction }
          );
          if (donantes.length > 0) {
            await sequelize.query(
              'UPDATE chequeo_personalizados SET tipo_equipo_personalizado_id = ? WHERE tipo_equipo_personalizado_id = ?',
              { replacements: [canonico, donantes[0].id], transaction }
            );
          }
        }

        await sequelize.query(
          'DELETE FROM chequeo_personalizados WHERE tipo_equipo_personalizado_id IN (?)',
          {
            replacements: [sobrantes],
            transaction
          }
        );
        await sequelize.query('DELETE FROM tipo_equipo_personalizados WHERE id IN (?)', {
          replacements: [sobrantes],
          transaction
        });
      }

      // 3. Un nombre de tipo por sucursal.
      await queryInterface.addConstraint('tipo_equipo_personalizados', {
        fields: ['sucursal_id', 'nombre'],
        type: 'unique',
        name: 'uq_tipo_equipo_sucursal_nombre',
        transaction
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    // Los duplicados fusionados no se pueden recuperar; solo se revierte el esquema.
    await queryInterface.removeConstraint('tipo_equipo_personalizados', 'uq_tipo_equipo_sucursal_nombre');
    await queryInterface.sequelize.query(
      'UPDATE tipo_equipo_personalizados SET usuario_id = 0 WHERE usuario_id IS NULL'
    );
    await queryInterface.changeColumn('tipo_equipo_personalizados', 'usuario_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
  }
};
