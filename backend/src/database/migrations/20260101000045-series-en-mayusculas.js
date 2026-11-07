'use strict';

/**
 * Los números de serie van siempre en mayúsculas, como vienen impresos en la
 * caja y en el equipo. La API ya los guarda así; esto pasa los que se cargaron
 * antes. Se puede correr de nuevo: solo toca los que tienen minúsculas.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    for (const tabla of ['equipos', 'equipos_stock', 'venta_partes_pago']) {
      await queryInterface.sequelize.query(
        `UPDATE ${tabla} SET numero_serie = UPPER(numero_serie)
          WHERE numero_serie IS NOT NULL AND BINARY numero_serie <> BINARY UPPER(numero_serie)`
      );
    }
  },

  // No hay vuelta atrás: no se sabe cuáles estaban en minúsculas.
  async down() {}
};
