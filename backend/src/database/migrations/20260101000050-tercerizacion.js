'use strict';

const { agregarIndice, crearTabla } = require('../migraciones-seguras');

const ANTERIORES = [
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
const NUEVOS = [
  'por_recibir',
  'recibido',
  'en_diagnostico',
  'presupuestado',
  'aprobado',
  'rechazado',
  'en_reparacion',
  'externo',
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
 * Tercerización de reparaciones: el taller manda el equipo a otro taller o a un
 * técnico de afuera.
 *
 * - `ordenes.estado` suma `externo` (el equipo está afuera; el cliente sigue
 *   viendo "En reparación") y `por_recibir` (la orden que se le arma sola al
 *   taller destino cuando también usa RepairOS, hasta que le llega el equipo).
 * - `tercerizaciones`: cada envío, con los datos de quién lo recibe. Si el
 *   destino es un taller de RepairOS, `taller_destino_id` y `orden_destino_id`
 *   apuntan a ese taller y a la orden que se le creó.
 *
 * Al deshacer, `externo` vuelve a "en reparación" y `por_recibir` a "cancelado".
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('ordenes', 'estado', columnaEstado(Sequelize, NUEVOS));

    const ref = (tabla, allowNull = false, onDelete = 'RESTRICT') => ({
      type: Sequelize.INTEGER,
      allowNull,
      references: { model: tabla, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete
    });
    const ahora = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') };

    await crearTabla(queryInterface, 'tercerizaciones', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      orden_id: ref('ordenes', false, 'CASCADE'),
      estado: {
        type: Sequelize.ENUM('enviada', 'recibida', 'devuelta', 'cancelada'),
        allowNull: false,
        defaultValue: 'enviada'
      },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      dni_cuit: { type: Sequelize.STRING(11), allowNull: true },
      direccion: { type: Sequelize.STRING(255), allowNull: true },
      telefono: { type: Sequelize.STRING(50), allowNull: true },
      email: { type: Sequelize.STRING(150), allowNull: true },
      trabajo: { type: Sequelize.TEXT, allowNull: false },
      taller_destino_id: ref('talleres', true, 'SET NULL'),
      orden_destino_id: ref('ordenes', true, 'SET NULL'),
      enviada_por_id: ref('users', true, 'SET NULL'),
      recibida_en: { type: Sequelize.DATE, allowNull: true },
      devuelta_en: { type: Sequelize.DATE, allowNull: true },
      cancelada_en: { type: Sequelize.DATE, allowNull: true },
      created_at: ahora,
      updated_at: ahora
    });

    // Para autocompletar con los datos de un envío anterior al mismo destino.
    await agregarIndice(queryInterface, 'tercerizaciones', ['taller_id', 'dni_cuit'], {
      name: 'idx_tercerizaciones_taller_dni_cuit'
    });
    await agregarIndice(queryInterface, 'talleres', ['cuit'], { name: 'idx_talleres_cuit' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('talleres', 'idx_talleres_cuit');
    await queryInterface.dropTable('tercerizaciones');
    const { sequelize } = queryInterface;
    await sequelize.query("UPDATE ordenes SET estado = 'en_reparacion' WHERE estado = 'externo'");
    await sequelize.query("UPDATE ordenes SET estado = 'cancelado' WHERE estado = 'por_recibir'");
    await queryInterface.changeColumn('ordenes', 'estado', columnaEstado(Sequelize, ANTERIORES));
  }
};
