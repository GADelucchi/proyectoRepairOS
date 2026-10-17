'use strict';

const ANTERIORES = [
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
const NUEVOS = [
  'recibido',
  'en_diagnostico',
  'presupuestado',
  'aprobado',
  'rechazado',
  'en_reparacion',
  'en_espera',
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
 * Vuelve "en reparación" (se había sacado en la 37) y suma "en espera".
 *
 * Al deshacer, las órdenes en esos estados pasan al más cercano que sigue
 * existiendo: "en reparación" a "aprobado" y "en espera" a "recibido".
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ordenes', 'estado', columnaEstado(Sequelize, NUEVOS));
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.query("UPDATE ordenes SET estado = 'aprobado' WHERE estado = 'en_reparacion'");
    await sequelize.query("UPDATE ordenes SET estado = 'recibido' WHERE estado = 'en_espera'");
    await queryInterface.changeColumn('ordenes', 'estado', columnaEstado(Sequelize, ANTERIORES));
  }
};
