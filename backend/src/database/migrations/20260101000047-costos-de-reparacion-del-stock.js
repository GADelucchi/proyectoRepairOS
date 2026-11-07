'use strict';

const { agregarColumna, crearTabla } = require('../migraciones-seguras');

/**
 * Lo que se le pone a un equipo del stock antes (o después) de venderlo: una
 * batería, un módulo, la mano de obra. Suma al costo del equipo, y así a la
 * ganancia que muestra el informe de ventas.
 *
 * Cada costo queda con su moneda y, si no es en dólares, con la cotización del
 * día (1 US$ en esa moneda); `monto_usd` es ese costo ya pasado a dólares. Un
 * costo cargado por error no se borra: se anula, con quién y cuándo.
 *
 * `equipos_stock.costo_reparaciones_usd` es la suma de los costos vigentes de
 * cada equipo, para sumar el valor del stock sin recorrer los costos uno por uno.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const ref = (tabla, allowNull = false, onDelete = 'RESTRICT') => ({
      type: Sequelize.INTEGER,
      allowNull,
      references: { model: tabla, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete
    });
    const ahora = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') };

    await crearTabla(queryInterface, 'equipo_stock_costos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      equipo_stock_id: ref('equipos_stock'),
      concepto: { type: Sequelize.STRING(150), allowNull: false },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      moneda: { type: Sequelize.STRING(3), allowNull: false },
      monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      cotizacion: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      monto_usd: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      usuario_id: ref('users'),
      anulado_en: { type: Sequelize.DATE, allowNull: true },
      anulado_por_id: ref('users', true, 'SET NULL'),
      created_at: ahora,
      updated_at: ahora
    });

    await agregarColumna(queryInterface, 'equipos_stock', 'costo_reparaciones_usd', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'cotizacion_costo'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('equipos_stock', 'costo_reparaciones_usd');
    await queryInterface.dropTable('equipo_stock_costos');
  }
};
