'use strict';

/**
 * Planes y suscripción por taller.
 *
 * Los planes replican los del sitio público (landing/index.html): el precio y
 * los límites viven en la base para poder cambiarlos sin tocar código. Los
 * límites en NULL significan "sin tope" (el plan a medida).
 *
 * La suscripción arranca en `prueba` con un mes de gracia desde el alta: el
 * taller usa el sistema completo y recién después elige plan.
 *
 * @type {import('sequelize-cli').Migration}
 */

const PLANES = [
  {
    codigo: 'taller',
    nombre: 'Taller',
    descripcion: 'Para un local con hasta 2 técnicos.',
    precio_mensual: 44999,
    max_sucursales: 1,
    max_usuarios: 2,
    orden: 1
  },
  {
    codigo: 'cadena',
    nombre: 'Cadena',
    descripcion: 'Hasta 3 sucursales con técnicos ilimitados y permisos por sucursal.',
    precio_mensual: 64999,
    max_sucursales: 3,
    max_usuarios: null,
    orden: 2
  },
  {
    codigo: 'a_medida',
    nombre: 'A medida',
    descripcion: 'Más de 3 sucursales. El precio se acuerda con el equipo comercial.',
    precio_mensual: null,
    max_sucursales: null,
    max_usuarios: null,
    orden: 3
  }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('planes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      codigo: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      nombre: { type: Sequelize.STRING(80), allowNull: false },
      descripcion: { type: Sequelize.STRING(255), allowNull: true },
      // NULL = precio a convenir. Entero en pesos: no hay centavos en estos planes.
      precio_mensual: { type: Sequelize.INTEGER, allowNull: true },
      // NULL = sin tope.
      max_sucursales: { type: Sequelize.INTEGER, allowNull: true },
      max_usuarios: { type: Sequelize.INTEGER, allowNull: true },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    const ahora = new Date();
    await queryInterface.bulkInsert(
      'planes',
      PLANES.map((plan) => ({ ...plan, activo: true, created_at: ahora, updated_at: ahora }))
    );

    await queryInterface.createTable('suscripciones', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      // Un taller tiene exactamente una suscripción.
      taller_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'talleres', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      // NULL mientras está en prueba y todavía no eligió plan.
      plan_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'planes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      estado: {
        type: Sequelize.ENUM('prueba', 'activa', 'vencida', 'cancelada'),
        allowNull: false,
        defaultValue: 'prueba'
      },
      // Hasta cuándo puede usar el sistema sin haber pagado.
      gracia_hasta: { type: Sequelize.DATEONLY, allowNull: false },
      // Fin del período pago vigente (NULL mientras no hay cobro).
      periodo_fin: { type: Sequelize.DATEONLY, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('suscripciones');
    await queryInterface.dropTable('planes');
  }
};
