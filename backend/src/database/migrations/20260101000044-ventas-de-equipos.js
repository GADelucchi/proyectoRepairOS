'use strict';

const { agregarColumna, agregarIndice, crearTabla } = require('../migraciones-seguras');

/**
 * Venta de equipos del stock.
 *
 * - `ventas`: una por operación, con su número por taller (VTA-000001). Se
 *   reserva (sin pago, hasta una fecha), se seña (pagó una parte) o se completa.
 *   Nunca se borra: se cancela, o vence si era una reserva.
 * - `venta_items`: los equipos del stock que se lleva el cliente y a cuánto.
 * - `venta_partes_pago`: los equipos que deja el cliente como parte de pago.
 *   Entran al stock al completar la venta (`equipo_stock_id`), con el monto que
 *   se le descontó como costo.
 * - `venta_pagos`: la plata de la venta. La caja la suma junto con los cobros de
 *   reparaciones, pero separada por origen: venta, seña o devolución de seña.
 *
 * Todo en la moneda de la venta. Si no es en dólares, `cotizacion` es cuánto
 * valía 1 US$ ese día: el informe de ventas se calcula en US$.
 *
 * Los equipos del stock tampoco se borran: se dan de baja (`estado = 'baja'`)
 * con quién, cuándo y por qué.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const usuario = (onDelete = 'SET NULL') => ({
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete
    });
    const ref = (tabla) => ({
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: tabla, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
    const datosDeEquipo = {
      marca: { type: Sequelize.STRING(100), allowNull: false },
      modelo: { type: Sequelize.STRING(100), allowNull: false },
      color: { type: Sequelize.STRING(50), allowNull: true },
      almacenamiento_gb: { type: Sequelize.INTEGER, allowNull: true },
      condicion: { type: Sequelize.ENUM('nuevo', 'usado'), allowNull: false, defaultValue: 'usado' },
      bateria: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
      numero_serie: { type: Sequelize.STRING(150), allowNull: true },
      imei: { type: Sequelize.STRING(15), allowNull: true },
      imei2: { type: Sequelize.STRING(15), allowNull: true }
    };
    const ahora = { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') };

    await crearTabla(queryInterface, 'ventas', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      sucursal_id: ref('sucursales'),
      numero: { type: Sequelize.INTEGER, allowNull: false },
      cliente_id: ref('clientes'),
      estado: {
        type: Sequelize.ENUM('reservada', 'senada', 'completada', 'cancelada', 'vencida'),
        allowNull: false
      },
      moneda: { type: Sequelize.STRING(3), allowNull: false },
      cotizacion: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      descuento_tipo: { type: Sequelize.ENUM('porcentaje', 'monto'), allowNull: true },
      descuento_valor: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      descuento: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      parte_pago: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      reservada_hasta: { type: Sequelize.DATEONLY, allowNull: true },
      comentario_cliente: { type: Sequelize.TEXT, allowNull: true },
      comentario_interno: { type: Sequelize.TEXT, allowNull: true },
      vendedor_id: usuario(),
      completada_en: { type: Sequelize.DATE, allowNull: true },
      cancelada_en: { type: Sequelize.DATE, allowNull: true },
      cancelada_por_id: usuario(),
      motivo_cancelacion: { type: Sequelize.STRING(255), allowNull: true },
      aviso_sena_en: { type: Sequelize.DATE, allowNull: true },
      created_at: ahora,
      updated_at: ahora
    });
    await agregarIndice(queryInterface, 'ventas', ['taller_id', 'numero'], {
      unique: true,
      name: 'ventas_taller_numero'
    });
    await agregarIndice(queryInterface, 'ventas', ['taller_id', 'estado'], { name: 'ventas_taller_estado' });
    await agregarIndice(queryInterface, 'ventas', ['taller_id', 'completada_en'], {
      name: 'ventas_taller_completada'
    });

    await crearTabla(queryInterface, 'venta_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      venta_id: ref('ventas'),
      equipo_stock_id: ref('equipos_stock'),
      precio: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      created_at: ahora,
      updated_at: ahora
    });

    await crearTabla(queryInterface, 'venta_partes_pago', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      venta_id: ref('ventas'),
      ...datosDeEquipo,
      monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      observaciones: { type: Sequelize.TEXT, allowNull: true },
      equipo_stock_id: { ...ref('equipos_stock'), allowNull: true },
      created_at: ahora,
      updated_at: ahora
    });

    await crearTabla(queryInterface, 'venta_pagos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      sucursal_id: ref('sucursales'),
      venta_id: ref('ventas'),
      tipo: { type: Sequelize.ENUM('sena', 'pago', 'devolucion'), allowNull: false },
      monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      moneda: { type: Sequelize.STRING(3), allowNull: false },
      medio_pago: { type: Sequelize.STRING(20), allowNull: true },
      usuario_id: { ...usuario('RESTRICT'), allowNull: false },
      nota: { type: Sequelize.STRING(255), allowNull: true },
      created_at: ahora,
      updated_at: ahora
    });
    // La caja filtra por taller y fecha, igual que `cuenta_movimientos`.
    await agregarIndice(queryInterface, 'venta_pagos', ['taller_id', 'created_at'], {
      name: 'venta_pagos_taller_fecha'
    });

    await queryInterface.changeColumn('equipos_stock', 'estado', {
      type: Sequelize.ENUM('disponible', 'reservado', 'senado', 'vendido', 'baja'),
      allowNull: false,
      defaultValue: 'disponible'
    });
    await agregarColumna(queryInterface, 'equipos_stock', 'baja_en', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await agregarColumna(queryInterface, 'equipos_stock', 'baja_por_id', usuario());
    await agregarColumna(queryInterface, 'equipos_stock', 'motivo_baja', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    // El equipo entró como parte de pago de esta venta.
    await agregarColumna(queryInterface, 'equipos_stock', 'recibido_en_venta_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'ventas', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await agregarColumna(queryInterface, 'talleres', 'terminos_venta', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('talleres', 'terminos_venta');
    await queryInterface.removeColumn('equipos_stock', 'recibido_en_venta_id');
    await queryInterface.removeColumn('equipos_stock', 'motivo_baja');
    await queryInterface.removeColumn('equipos_stock', 'baja_por_id');
    await queryInterface.removeColumn('equipos_stock', 'baja_en');
    await queryInterface.sequelize.query(
      "UPDATE equipos_stock SET estado = 'disponible' WHERE estado = 'baja'"
    );
    await queryInterface.changeColumn('equipos_stock', 'estado', {
      type: Sequelize.ENUM('disponible', 'reservado', 'senado', 'vendido'),
      allowNull: false,
      defaultValue: 'disponible'
    });
    await queryInterface.dropTable('venta_pagos');
    await queryInterface.dropTable('venta_partes_pago');
    await queryInterface.dropTable('venta_items');
    await queryInterface.dropTable('ventas');
  }
};
