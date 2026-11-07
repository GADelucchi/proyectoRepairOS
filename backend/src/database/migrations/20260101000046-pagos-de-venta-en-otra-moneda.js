'use strict';

const { agregarColumna } = require('../migraciones-seguras');

/**
 * Una venta se puede pagar en varias monedas: US$ 900 en dólares y el resto en
 * pesos. Cada pago queda en la moneda en la que entró la plata (así la caja
 * cuadra con el cajón) y además se guarda cuánto cubre de la venta:
 *
 * - `cotizacion`: 1 US$ en la moneda que no es dólar, si el pago es en otra
 *   moneda que la venta. Null si es en la misma.
 * - `equivalente`: el pago en la moneda de la venta. Es lo que baja el saldo.
 *
 * Los pagos anteriores eran todos en la moneda de la venta: su equivalente es
 * el mismo monto.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await agregarColumna(queryInterface, 'venta_pagos', 'cotizacion', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
      after: 'moneda'
    });
    await agregarColumna(queryInterface, 'venta_pagos', 'equivalente', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      after: 'cotizacion'
    });
    await queryInterface.sequelize.query('UPDATE venta_pagos SET equivalente = monto WHERE equivalente IS NULL');
    await queryInterface.changeColumn('venta_pagos', 'equivalente', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('venta_pagos', 'equivalente');
    await queryInterface.removeColumn('venta_pagos', 'cotizacion');
  }
};
