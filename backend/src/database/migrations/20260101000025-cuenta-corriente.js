'use strict';

/**
 * Cuenta corriente por cliente.
 *
 * Hasta acá la plata de una orden vivía en `presupuesto_monto` y nada registraba
 * si el cliente pagó al retirar. Ahora la entrega anota el total y lo abonado, y
 * la diferencia queda como deuda en un libro de movimientos por cliente.
 *
 * El saldo no se guarda en una columna: se calcula sumando los movimientos. Un
 * total desnormalizado se desincroniza en cuanto un cobro falla a mitad de
 * camino, y acá el número tiene que poder defenderse frente al cliente.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fiar es una decisión explícita: por defecto nadie se lleva nada debiendo.
    await queryInterface.addColumn('clientes', 'cuenta_corriente_habilitada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Lo que efectivamente se cobró al entregar, que puede diferir del presupuesto.
    await queryInterface.addColumn('ordenes', 'monto_total', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true
    });
    await queryInterface.addColumn('ordenes', 'monto_abonado', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true
    });
    await queryInterface.addColumn('ordenes', 'fecha_entrega', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.createTable('cuenta_movimientos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'talleres', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      cliente_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'clientes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      // La orden que originó el cargo. Queda en NULL si la orden se borra: el
      // movimiento es un hecho contable y no puede desaparecer con ella.
      orden_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'ordenes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      sucursal_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      // `cargo` suma deuda, `pago` la descuenta. El monto es siempre positivo:
      // el signo lo pone el tipo, así no hay dos formas de anotar lo mismo.
      tipo: { type: Sequelize.ENUM('cargo', 'pago'), allowNull: false },
      monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      medio_pago: { type: Sequelize.STRING(30), allowNull: true },
      nota: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    // El saldo se arma recorriendo los movimientos de un cliente en orden.
    await queryInterface.addIndex('cuenta_movimientos', ['taller_id', 'cliente_id', 'created_at'], {
      name: 'ix_cuenta_movimientos_cliente'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cuenta_movimientos');
    await queryInterface.removeColumn('ordenes', 'fecha_entrega');
    await queryInterface.removeColumn('ordenes', 'monto_abonado');
    await queryInterface.removeColumn('ordenes', 'monto_total');
    await queryInterface.removeColumn('clientes', 'cuenta_corriente_habilitada');
  }
};
