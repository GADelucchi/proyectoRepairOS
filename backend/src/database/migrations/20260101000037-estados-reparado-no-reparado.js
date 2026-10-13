'use strict';

const ANTERIORES = [
  'recibido',
  'en_diagnostico',
  'presupuestado',
  'aprobado',
  'rechazado',
  'en_reparacion',
  'listo_para_retirar',
  'entregado',
  'cancelado'
];
const NUEVOS = [
  'recibido',
  'en_diagnostico',
  'presupuestado',
  'aprobado',
  'rechazado',
  'listo_para_retirar',
  'no_reparado',
  'entregado',
  'cancelado'
];

const columnaEstado = (Sequelize, valores) => ({
  type: Sequelize.ENUM(...valores),
  allowNull: false,
  defaultValue: 'recibido'
});

/**
 * Saca "en reparación" (no se usaba) y suma "no reparado - listo para retirar".
 *
 * Las órdenes que estaban en reparación vuelven a "aprobado", el paso anterior:
 * desde ahí pasan a reparado o no reparado. El historial guarda el estado como
 * texto y queda como está.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(
      'ordenes',
      'estado',
      columnaEstado(Sequelize, [...ANTERIORES, 'no_reparado'])
    );
    await queryInterface.sequelize.query(
      "UPDATE ordenes SET estado = 'aprobado' WHERE estado = 'en_reparacion'"
    );
    await queryInterface.changeColumn('ordenes', 'estado', columnaEstado(Sequelize, NUEVOS));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(
      'ordenes',
      'estado',
      columnaEstado(Sequelize, [...ANTERIORES, 'no_reparado'])
    );
    await queryInterface.sequelize.query(
      "UPDATE ordenes SET estado = 'listo_para_retirar' WHERE estado = 'no_reparado'"
    );
    await queryInterface.changeColumn('ordenes', 'estado', columnaEstado(Sequelize, ANTERIORES));
  }
};
