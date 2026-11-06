'use strict';

/**
 * Stock de equipos para la venta.
 *
 * Cada fila es una unidad con su propio costo: dos iPhone iguales comprados en
 * meses distintos guardan cada uno lo que costó, y el informe toma el costo de
 * la unidad que se vendió. `cotizacion_costo` es cuántas unidades de la moneda
 * del costo valía 1 US$ el día de compra; solo hace falta si el costo no es en
 * dólares, porque el informe se calcula en US$.
 *
 * El número (#0042) se lleva por taller, como el de las órdenes. El stock vive en
 * una sucursal; `talleres.stock_entre_sucursales` habilita ver el de las demás.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipos_stock', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'talleres', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      sucursal_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'sucursales', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      numero: { type: Sequelize.INTEGER, allowNull: false },
      marca: { type: Sequelize.STRING(100), allowNull: false },
      modelo: { type: Sequelize.STRING(100), allowNull: false },
      color: { type: Sequelize.STRING(50), allowNull: true },
      almacenamiento_gb: { type: Sequelize.INTEGER, allowNull: true },
      condicion: { type: Sequelize.ENUM('nuevo', 'usado'), allowNull: false },
      // Salud de la batería en %, solo en usados.
      bateria: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
      numero_serie: { type: Sequelize.STRING(150), allowNull: true },
      imei: { type: Sequelize.STRING(15), allowNull: true },
      imei2: { type: Sequelize.STRING(15), allowNull: true },
      fecha_compra: { type: Sequelize.DATEONLY, allowNull: false },
      proveedor: { type: Sequelize.STRING(150), allowNull: true },
      moneda_costo: { type: Sequelize.STRING(3), allowNull: false },
      costo: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      cotizacion_costo: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      // Precio de lista: se puede cambiar al vender.
      moneda_precio: { type: Sequelize.STRING(3), allowNull: true },
      precio: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      estado: {
        type: Sequelize.ENUM('disponible', 'reservado', 'senado', 'vendido'),
        allowNull: false,
        defaultValue: 'disponible'
      },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      cargado_por_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });

    await queryInterface.addIndex('equipos_stock', ['taller_id', 'numero'], {
      unique: true,
      name: 'equipos_stock_taller_numero'
    });
    await queryInterface.addIndex('equipos_stock', ['taller_id', 'sucursal_id', 'estado'], {
      name: 'equipos_stock_sucursal_estado'
    });
    await queryInterface.addIndex('equipos_stock', ['taller_id', 'imei'], { name: 'equipos_stock_imei' });
    await queryInterface.addIndex('equipos_stock', ['taller_id', 'numero_serie'], {
      name: 'equipos_stock_numero_serie'
    });

    await queryInterface.addColumn('talleres', 'stock_entre_sucursales', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('talleres', 'stock_entre_sucursales');
    await queryInterface.dropTable('equipos_stock');
  }
};
