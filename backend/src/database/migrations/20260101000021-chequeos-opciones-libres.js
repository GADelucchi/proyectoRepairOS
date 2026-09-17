'use strict';

/**
 * Los chequeos de una orden dejan de estar atados a Sí/No/N/A.
 *
 * En Configuración se podían definir las opciones de respuesta de cada chequeo
 * ("Excelente / Regular / Malo", lo que sirviera para ese tipo de equipo), pero
 * al recibir el equipo la orden solo aceptaba el ENUM ('si','no','na'): las
 * opciones configuradas no se usaban en ningún lado.
 *
 * Cambios:
 *  - `resultado` pasa de ENUM a VARCHAR, así guarda la etiqueta elegida.
 *  - se agrega `opciones`, que congela las opciones vigentes al momento de la
 *    recepción. Si mañana se edita el checklist del tipo, las órdenes viejas
 *    siguen mostrando las opciones con las que realmente se las recibió.
 *
 * Los valores existentes se traducen a su etiqueta ('si' -> 'Sí').
 *
 * @type {import('sequelize-cli').Migration}
 */
const OPCIONES_CLASICAS = [{ etiqueta: 'Sí' }, { etiqueta: 'No' }, { etiqueta: 'N/A' }];

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await queryInterface.changeColumn('orden_chequeos', 'resultado', {
      type: Sequelize.STRING(80),
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn('orden_chequeos', 'opciones', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: OPCIONES_CLASICAS
    });

    // Traducir los resultados que venían del ENUM a la etiqueta que se muestra.
    await sequelize.query("UPDATE orden_chequeos SET resultado = 'Sí' WHERE resultado = 'si'");
    await sequelize.query("UPDATE orden_chequeos SET resultado = 'No' WHERE resultado = 'no'");
    await sequelize.query("UPDATE orden_chequeos SET resultado = 'N/A' WHERE resultado = 'na'");
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    await sequelize.query("UPDATE orden_chequeos SET resultado = 'si' WHERE resultado = 'Sí'");
    await sequelize.query("UPDATE orden_chequeos SET resultado = 'no' WHERE resultado = 'No'");
    await sequelize.query("UPDATE orden_chequeos SET resultado = 'na' WHERE resultado = 'N/A'");
    // Cualquier etiqueta personalizada no entra en el ENUM: se pierde.
    await sequelize.query(
      "UPDATE orden_chequeos SET resultado = NULL WHERE resultado NOT IN ('si', 'no', 'na')"
    );

    await queryInterface.removeColumn('orden_chequeos', 'opciones');
    await queryInterface.changeColumn('orden_chequeos', 'resultado', {
      type: Sequelize.ENUM('si', 'no', 'na'),
      allowNull: true,
      defaultValue: null
    });
  }
};
