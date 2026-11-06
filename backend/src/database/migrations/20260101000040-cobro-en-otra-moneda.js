'use strict';

const { agregarColumna, crearTabla } = require('../migraciones-seguras');

/**
 * Cobrar en una moneda distinta a la del presupuesto.
 *
 * - `ordenes.moneda_cobro`: en qué moneda quedaron el total y lo abonado de la
 *   entrega. `moneda` sigue siendo la del presupuesto. Vacía hasta entregar; las
 *   órdenes ya entregadas se cobraron en la moneda de su presupuesto.
 * - `orden_precios`: precios alternativos al de lista (por ejemplo, en pesos y en
 *   efectivo). El de lista sigue en `presupuesto_monto` + `moneda`.
 * - `conversion_debito` / `conversion_credito`: pagar en pesos una deuda en dólares
 *   baja la deuda en dólares y entra plata en pesos, sin mezclar las monedas en
 *   un mismo asiento. No son cobros: la plata que entró es el `pago` que los acompaña.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await agregarColumna(queryInterface, 'ordenes', 'moneda_cobro', {
      type: Sequelize.STRING(3),
      allowNull: true
    });
    await queryInterface.sequelize.query(
      'UPDATE ordenes SET moneda_cobro = moneda WHERE monto_total IS NOT NULL'
    );

    await queryInterface.changeColumn('cuenta_movimientos', 'tipo', {
      type: Sequelize.ENUM(
        'cargo',
        'pago',
        'ajuste_debito',
        'ajuste_credito',
        'conversion_debito',
        'conversion_credito'
      ),
      allowNull: false
    });

    await crearTabla(queryInterface, 'orden_precios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      orden_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ordenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      // Vacío: el precio vale para cualquier medio de pago.
      medio_pago: { type: Sequelize.STRING(30), allowNull: true },
      moneda: { type: Sequelize.STRING(3), allowNull: false },
      monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orden_precios');
    await queryInterface.sequelize.query(
      "DELETE FROM cuenta_movimientos WHERE tipo IN ('conversion_debito', 'conversion_credito')"
    );
    await queryInterface.changeColumn('cuenta_movimientos', 'tipo', {
      type: Sequelize.ENUM('cargo', 'pago', 'ajuste_debito', 'ajuste_credito'),
      allowNull: false
    });
    await queryInterface.removeColumn('ordenes', 'moneda_cobro');
  }
};
