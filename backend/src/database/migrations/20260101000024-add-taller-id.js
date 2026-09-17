'use strict';

/**
 * Cuelga del taller todo lo que se consulta desde la raíz.
 *
 * Son cuatro tablas: `users`, `sucursales`, `clientes` y `equipos`. El resto no
 * necesita la columna porque siempre se llega por un padre ya filtrado —las
 * órdenes por `sucursal_id`, los tipos de equipo por `sucursal_id`, y los
 * chequeos, imágenes e historial por `orden_id`—.
 *
 * Los datos que ya existían se asignan a un taller creado acá, para que la base
 * de una instalación en uso siga funcionando igual después de migrar.
 *
 * @type {import('sequelize-cli').Migration}
 */

const TABLAS = ['users', 'sucursales', 'clientes', 'equipos'];
const TALLER_EXISTENTE = 'Taller principal';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const { QueryTypes } = sequelize;

    for (const tabla of TABLAS) {
      await queryInterface.addColumn(tabla, 'taller_id', { type: Sequelize.INTEGER, allowNull: true });
    }

    // ¿Hay datos previos que adoptar?
    const conteos = await Promise.all(
      TABLAS.map(async (tabla) => {
        const [{ total }] = await sequelize.query(`SELECT COUNT(*) AS total FROM \`${tabla}\``, {
          type: QueryTypes.SELECT
        });
        return Number(total);
      })
    );

    if (conteos.some((total) => total > 0)) {
      const ahora = new Date();
      await queryInterface.bulkInsert('talleres', [
        { nombre: TALLER_EXISTENTE, activo: true, created_at: ahora, updated_at: ahora }
      ]);

      const [taller] = await sequelize.query('SELECT id FROM talleres WHERE nombre = ? LIMIT 1', {
        replacements: [TALLER_EXISTENTE],
        type: QueryTypes.SELECT
      });

      for (const tabla of TABLAS) {
        await sequelize.query(`UPDATE \`${tabla}\` SET taller_id = ?`, { replacements: [taller.id] });
      }

      // Este taller ya venía operando: no corresponde mandarlo a prueba.
      const graciaHasta = new Date(ahora);
      graciaHasta.setMonth(graciaHasta.getMonth() + 1);
      await queryInterface.bulkInsert('suscripciones', [
        {
          taller_id: taller.id,
          plan_id: null,
          estado: 'activa',
          gracia_hasta: graciaHasta.toISOString().slice(0, 10),
          periodo_fin: null,
          created_at: ahora,
          updated_at: ahora
        }
      ]);

      // La numeración de órdenes pasa a ser por taller.
      await sequelize.query('UPDATE contadores SET clave = ? WHERE clave = ?', {
        replacements: [`orden:${taller.id}`, 'orden']
      });
    } else {
      // Base recién creada: no queda nadie usando la clave global.
      await sequelize.query('DELETE FROM contadores WHERE clave = ?', { replacements: ['orden'] });
    }

    for (const tabla of TABLAS) {
      await queryInterface.changeColumn(tabla, 'taller_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      });
      await queryInterface.addConstraint(tabla, {
        fields: ['taller_id'],
        type: 'foreign key',
        name: `fk_${tabla}_taller`,
        references: { table: 'talleres', field: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      });
    }

    // El número de serie era único en toda la base: dos talleres distintos no
    // podían recibir equipos con el mismo serial de fábrica, y el choque le
    // revelaba a uno que el otro ya lo tenía cargado. Pasa a ser único por taller.
    await queryInterface.removeConstraint('equipos', 'uq_equipos_numero_serie');
    await queryInterface.addConstraint('equipos', {
      fields: ['taller_id', 'numero_serie'],
      type: 'unique',
      name: 'uq_equipos_taller_numero_serie'
    });
  },

  async down(queryInterface) {
    // Las claves foráneas van primero: MySQL usa el índice único compuesto para
    // sostener la de `equipos` y no deja borrarlo mientras la restricción viva.
    for (const tabla of TABLAS) {
      await queryInterface.removeConstraint(tabla, `fk_${tabla}_taller`);
    }

    await queryInterface.removeConstraint('equipos', 'uq_equipos_taller_numero_serie');
    await queryInterface.addConstraint('equipos', {
      fields: ['numero_serie'],
      type: 'unique',
      name: 'uq_equipos_numero_serie'
    });

    for (const tabla of TABLAS) {
      await queryInterface.removeColumn(tabla, 'taller_id');
    }

    // Los contadores por taller se funden en el global, tomando el mayor emitido.
    const { sequelize } = queryInterface;
    const [{ maximo }] = await sequelize.query(
      "SELECT COALESCE(MAX(valor), 0) AS maximo FROM contadores WHERE clave LIKE 'orden:%'",
      { type: sequelize.QueryTypes.SELECT }
    );
    await sequelize.query("DELETE FROM contadores WHERE clave LIKE 'orden:%'");
    await queryInterface.bulkInsert('contadores', [
      { clave: 'orden', valor: Number(maximo) || 0, created_at: new Date(), updated_at: new Date() }
    ]);
  }
};
