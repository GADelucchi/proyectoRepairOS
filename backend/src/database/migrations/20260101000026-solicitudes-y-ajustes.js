'use strict';

/**
 * Autorizaciones: fiar sin cuenta habilitada y ajustar una cuenta corriente.
 *
 * Las dos son decisiones que mueven plata y que el mostrador no puede tomar
 * solo, pero frenarlas del todo deja al cliente esperando en el local. La
 * solución es pedirlas: el técnico deja la solicitud y un admin la aprueba o la
 * rechaza, y recién ahí se ejecuta.
 *
 * Se guarda la solicitud entera —qué se pedía, quién lo pidió, quién resolvió y
 * por qué— porque el registro de quién autorizó fiar es justamente el que se
 * necesita cuando esa deuda no se cobra.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Un ajuste no es plata que entró ni salió: corrige el saldo. Va como tipo
    // propio para que los informes de caja no lo cuenten como cobro.
    await queryInterface.changeColumn('cuenta_movimientos', 'tipo', {
      type: Sequelize.ENUM('cargo', 'pago', 'ajuste_debito', 'ajuste_credito'),
      allowNull: false
    });

    await queryInterface.createTable('solicitudes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'talleres', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      tipo: { type: Sequelize.ENUM('fiado', 'ajuste'), allowNull: false },
      estado: {
        type: Sequelize.ENUM('pendiente', 'aprobada', 'rechazada', 'cancelada'),
        allowNull: false,
        defaultValue: 'pendiente'
      },
      cliente_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      // Solo las de fiado apuntan a una orden; los ajustes van contra la cuenta.
      orden_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'ordenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sucursal_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      solicitante_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      resuelto_por_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      /** Lo que está en juego: lo que se fiaría, o el monto del ajuste. */
      monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      /** Lo que hace falta para ejecutarla al aprobarse. */
      datos: { type: Sequelize.JSON, allowNull: true },
      motivo: { type: Sequelize.STRING(500), allowNull: false },
      respuesta: { type: Sequelize.STRING(500), allowNull: true },
      resuelto_en: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    // La consulta de todos los días es "qué tengo pendiente de aprobar".
    await queryInterface.addIndex('solicitudes', ['taller_id', 'estado', 'created_at'], {
      name: 'ix_solicitudes_pendientes'
    });

    // Una orden no puede tener dos pedidos de fiado en curso a la vez.
    await queryInterface.addIndex('solicitudes', ['orden_id', 'estado'], {
      name: 'ix_solicitudes_orden'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('solicitudes');
    await queryInterface.sequelize.query(
      "DELETE FROM cuenta_movimientos WHERE tipo IN ('ajuste_debito', 'ajuste_credito')"
    );
    await queryInterface.changeColumn('cuenta_movimientos', 'tipo', {
      type: Sequelize.ENUM('cargo', 'pago'),
      allowNull: false
    });
  }
};
