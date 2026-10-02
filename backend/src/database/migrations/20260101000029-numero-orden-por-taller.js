'use strict';

/**
 * La numeración de órdenes pasa a ser única por taller.
 *
 * El contador ya era por taller (`orden:<tallerId>`), pero `numero_orden` tenía
 * un UNIQUE global: el segundo taller que creaba su ORD-000001 chocaba contra el
 * del primero y la API respondía 500.
 *
 * Se agrega `taller_id` a `ordenes` (se completa desde la sucursal) y el índice
 * único pasa a ser `(taller_id, numero_orden)`.
 *
 * @type {import('sequelize-cli').Migration}
 */

const INDICE_NUEVO = 'uq_ordenes_taller_numero';
const FK_TALLER = 'fk_ordenes_taller';

/** Nombres de los índices únicos que cubren solo `numero_orden`. */
async function indicesUnicosDeNumeroOrden(sequelize) {
  const filas = await sequelize.query(
    `SELECT INDEX_NAME AS nombre
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordenes' AND NON_UNIQUE = 0
      GROUP BY INDEX_NAME
     HAVING COUNT(*) = 1 AND MAX(COLUMN_NAME) = 'numero_orden'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return filas.map((f) => f.nombre);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await queryInterface.addColumn('ordenes', 'taller_id', { type: Sequelize.INTEGER, allowNull: true });
    await sequelize.query(
      'UPDATE ordenes o JOIN sucursales s ON s.id = o.sucursal_id SET o.taller_id = s.taller_id'
    );
    await queryInterface.changeColumn('ordenes', 'taller_id', { type: Sequelize.INTEGER, allowNull: false });
    await queryInterface.addConstraint('ordenes', {
      fields: ['taller_id'],
      type: 'foreign key',
      name: FK_TALLER,
      references: { table: 'talleres', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    for (const nombre of await indicesUnicosDeNumeroOrden(sequelize)) {
      await queryInterface.removeIndex('ordenes', nombre);
    }
    await queryInterface.addConstraint('ordenes', {
      fields: ['taller_id', 'numero_orden'],
      type: 'unique',
      name: INDICE_NUEVO
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('ordenes', FK_TALLER);
    await queryInterface.removeConstraint('ordenes', INDICE_NUEVO);
    // Volver al UNIQUE global falla si ya hay números repetidos entre talleres:
    // en ese caso hay que renumerar a mano antes de bajar esta migración.
    await queryInterface.addConstraint('ordenes', {
      fields: ['numero_orden'],
      type: 'unique',
      name: 'numero_orden'
    });
    await queryInterface.removeColumn('ordenes', 'taller_id');
  }
};
