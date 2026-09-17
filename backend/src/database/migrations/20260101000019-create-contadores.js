'use strict';

/**
 * Contador persistente para los números de orden.
 *
 * Antes el número salía de `COUNT(*)` sobre `ordenes`, con dos problemas: dos
 * recepciones simultáneas leían el mismo total y generaban el mismo número, y
 * el contador retrocedía si alguna vez se borraba una fila.
 *
 * Con esta tabla el número se toma bajo `SELECT ... FOR UPDATE`, así que las
 * altas concurrentes se serializan (la segunda espera a que la primera termine)
 * y el valor solo avanza.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contadores', {
      clave: { type: Sequelize.STRING(50), primaryKey: true },
      valor: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    // Arranca donde terminó la numeración vieja, para no repetir números ya emitidos.
    const [{ maximo }] = await queryInterface.sequelize.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_orden, 5) AS UNSIGNED)), 0) AS maximo
         FROM ordenes
        WHERE numero_orden REGEXP '^ORD-[0-9]+$'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    await queryInterface.bulkInsert('contadores', [
      { clave: 'orden', valor: Number(maximo) || 0, created_at: new Date(), updated_at: new Date() }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contadores');
  }
};
