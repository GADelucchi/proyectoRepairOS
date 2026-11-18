'use strict';

const { agregarColumna, agregarIndice, crearTabla } = require('../migraciones-seguras');

const ESTADOS_STOCK_ANTES = ['disponible', 'reservado', 'senado', 'vendido', 'baja'];
const ESTADOS_STOCK = ['disponible', 'en_camino', 'reservado', 'senado', 'vendido', 'baja'];

const TIPOS_MOVIMIENTO = [
  'entrada',
  'orden',
  'orden_devolucion',
  'perdida',
  'venta',
  'venta_devolucion',
  'equipo_stock',
  'equipo_stock_devolucion',
  'pase_salida',
  'pase_entrada',
  'pase_cancelado',
  'baja'
];

/**
 * Inventario: repuestos, accesorios y servicios.
 *
 * - `articulos`: un repuesto, un accesorio o un servicio (`tipo`). Los dos
 *   primeros tienen stock; el servicio es lo que se cobra y puede llevar
 *   repuestos (`servicio_repuestos`). Hasta tres precios, con los nombres que
 *   define el taller (`talleres.inventario_config`).
 * - `inventario_entradas`: cada compra de un artículo en una sucursal, con lo
 *   que costó cada unidad. `disponible` es lo que queda de esa entrada. Las
 *   unidades se usan de la entrada más vieja primero, así el costo de lo que se
 *   usa es el real. `costo_usd` es el costo de una unidad ya en dólares.
 * - `inventario_consumos`: unidades que se usaron en una orden, una venta o un
 *   equipo del stock, con la entrada de la que salieron. Si vuelven al stock
 *   quedan `devuelto`; si se rompieron al usarlas, `perdido` (siguen siendo costo).
 * - `inventario_movimientos`: el historial de cada cambio de cantidad.
 * - `orden_servicios`: los servicios que se agregaron a una orden.
 * - `pases` y `pase_items`: lo que se manda de una sucursal a otra. Queda "en
 *   camino" hasta que la otra sucursal confirma que lo recibió; recién ahí
 *   entra a su stock. Los equipos del stock en camino quedan `en_camino`.
 *
 * Además: la venta puede llevar artículos con cantidad, la orden guarda la
 * cotización con la que se cobró (para el informe en US$) y la tercerización lo
 * que cobró el taller externo.
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
    const timestamps = { created_at: ahora, updated_at: ahora };
    // Un objeto nuevo por columna: Sequelize anota datos de la columna en la definición.
    const precio = () => ({ type: Sequelize.DECIMAL(12, 2), allowNull: true });
    const moneda = () => ({ type: Sequelize.STRING(3), allowNull: true });

    await agregarColumna(queryInterface, 'talleres', 'inventario_config', {
      type: Sequelize.JSON,
      allowNull: true
    });

    await crearTabla(queryInterface, 'inventario_categorias', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      grupo: { type: Sequelize.ENUM('repuesto', 'accesorio', 'servicio'), allowNull: false },
      nombre: { type: Sequelize.STRING(100), allowNull: false },
      ...timestamps
    });
    await agregarIndice(queryInterface, 'inventario_categorias', ['taller_id', 'grupo', 'nombre'], {
      unique: true,
      name: 'inventario_categorias_nombre'
    });

    await crearTabla(queryInterface, 'articulos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      tipo: { type: Sequelize.ENUM('repuesto', 'accesorio', 'servicio'), allowNull: false },
      categoria_id: ref('inventario_categorias', true, 'SET NULL'),
      codigo: { type: Sequelize.STRING(30), allowNull: false },
      codigo_barras: { type: Sequelize.STRING(64), allowNull: true },
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      stock_minimo: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      precio1: precio(),
      moneda1: moneda(),
      precio2: precio(),
      moneda2: moneda(),
      precio3: precio(),
      moneda3: moneda(),
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps
    });
    await agregarIndice(queryInterface, 'articulos', ['taller_id', 'codigo'], {
      unique: true,
      name: 'articulos_taller_codigo'
    });
    await agregarIndice(queryInterface, 'articulos', ['taller_id', 'codigo_barras'], {
      name: 'articulos_codigo_barras'
    });
    await agregarIndice(queryInterface, 'articulos', ['taller_id', 'tipo', 'activo'], {
      name: 'articulos_tipo'
    });

    await crearTabla(queryInterface, 'servicio_repuestos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      servicio_id: ref('articulos', false, 'CASCADE'),
      repuesto_id: ref('articulos'),
      cantidad: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      ...timestamps
    });
    await agregarIndice(queryInterface, 'servicio_repuestos', ['servicio_id', 'repuesto_id'], {
      unique: true,
      name: 'servicio_repuestos_unico'
    });

    await crearTabla(queryInterface, 'pases', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      numero: { type: Sequelize.INTEGER, allowNull: false },
      sucursal_origen_id: ref('sucursales'),
      sucursal_destino_id: ref('sucursales'),
      estado: {
        type: Sequelize.ENUM('en_camino', 'recibido', 'cancelado'),
        allowNull: false,
        defaultValue: 'en_camino'
      },
      nota: { type: Sequelize.STRING(255), allowNull: true },
      enviado_por_id: ref('users', true, 'SET NULL'),
      recibido_por_id: ref('users', true, 'SET NULL'),
      recibido_en: { type: Sequelize.DATE, allowNull: true },
      cancelado_por_id: ref('users', true, 'SET NULL'),
      cancelado_en: { type: Sequelize.DATE, allowNull: true },
      ...timestamps
    });
    await agregarIndice(queryInterface, 'pases', ['taller_id', 'numero'], {
      unique: true,
      name: 'pases_taller_numero'
    });

    await crearTabla(queryInterface, 'inventario_entradas', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      sucursal_id: ref('sucursales'),
      articulo_id: ref('articulos'),
      numero: { type: Sequelize.INTEGER, allowNull: false },
      origen: { type: Sequelize.ENUM('compra', 'pase'), allowNull: false, defaultValue: 'compra' },
      pase_id: ref('pases', true, 'SET NULL'),
      entrada_origen_id: ref('inventario_entradas', true, 'SET NULL'),
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      cantidad: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      disponible: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      moneda: { type: Sequelize.STRING(3), allowNull: false },
      costo: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      cotizacion: { type: Sequelize.DECIMAL(14, 4), allowNull: true },
      costo_usd: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      proveedor: { type: Sequelize.STRING(150), allowNull: true },
      nota: { type: Sequelize.STRING(255), allowNull: true },
      cargada_por_id: ref('users', true, 'SET NULL'),
      ...timestamps
    });
    await agregarIndice(queryInterface, 'inventario_entradas', ['taller_id', 'numero'], {
      unique: true,
      name: 'inventario_entradas_numero'
    });
    await agregarIndice(queryInterface, 'inventario_entradas', ['articulo_id', 'sucursal_id', 'disponible'], {
      name: 'inventario_entradas_fifo'
    });

    await crearTabla(queryInterface, 'pase_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      pase_id: ref('pases', false, 'CASCADE'),
      articulo_id: ref('articulos', true),
      entrada_id: ref('inventario_entradas', true),
      equipo_stock_id: ref('equipos_stock', true),
      cantidad: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      ...timestamps
    });

    await crearTabla(queryInterface, 'orden_servicios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      orden_id: ref('ordenes', false, 'CASCADE'),
      servicio_id: ref('articulos'),
      nombre: { type: Sequelize.STRING(150), allowNull: false },
      usuario_id: ref('users', true, 'SET NULL'),
      ...timestamps
    });

    await agregarColumna(queryInterface, 'venta_items', 'articulo_id', {
      ...ref('articulos', true),
      after: 'equipo_stock_id'
    });
    await agregarColumna(queryInterface, 'venta_items', 'cantidad', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      after: 'articulo_id'
    });
    // Un renglón de la venta es un equipo del stock o un artículo del inventario.
    await queryInterface.changeColumn('venta_items', 'equipo_stock_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await crearTabla(queryInterface, 'inventario_consumos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      sucursal_id: ref('sucursales'),
      articulo_id: ref('articulos'),
      entrada_id: ref('inventario_entradas'),
      cantidad: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      costo_usd: { type: Sequelize.DECIMAL(12, 4), allowNull: false },
      origen: { type: Sequelize.ENUM('orden', 'venta', 'equipo_stock'), allowNull: false },
      orden_id: ref('ordenes', true, 'CASCADE'),
      orden_servicio_id: ref('orden_servicios', true, 'SET NULL'),
      venta_item_id: ref('venta_items', true, 'CASCADE'),
      equipo_stock_costo_id: ref('equipo_stock_costos', true, 'SET NULL'),
      estado: {
        type: Sequelize.ENUM('usado', 'devuelto', 'perdido'),
        allowNull: false,
        defaultValue: 'usado'
      },
      motivo: { type: Sequelize.STRING(255), allowNull: true },
      usuario_id: ref('users', true, 'SET NULL'),
      ...timestamps
    });
    await agregarIndice(queryInterface, 'inventario_consumos', ['orden_id', 'estado'], {
      name: 'inventario_consumos_orden'
    });

    await crearTabla(queryInterface, 'inventario_movimientos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      taller_id: ref('talleres'),
      sucursal_id: ref('sucursales'),
      articulo_id: ref('articulos'),
      entrada_id: ref('inventario_entradas', true, 'SET NULL'),
      tipo: { type: Sequelize.ENUM(...TIPOS_MOVIMIENTO), allowNull: false },
      // Positivo entra, negativo sale.
      cantidad: { type: Sequelize.INTEGER, allowNull: false },
      orden_id: ref('ordenes', true, 'SET NULL'),
      venta_id: ref('ventas', true, 'SET NULL'),
      pase_id: ref('pases', true, 'SET NULL'),
      equipo_stock_id: ref('equipos_stock', true, 'SET NULL'),
      usuario_id: ref('users', true, 'SET NULL'),
      nota: { type: Sequelize.STRING(255), allowNull: true },
      ...timestamps
    });
    await agregarIndice(
      queryInterface,
      'inventario_movimientos',
      ['articulo_id', 'sucursal_id', 'created_at'],
      {
        name: 'inventario_movimientos_articulo'
      }
    );

    await queryInterface.changeColumn('equipos_stock', 'estado', {
      type: Sequelize.ENUM(...ESTADOS_STOCK),
      allowNull: false,
      defaultValue: 'disponible'
    });

    await agregarColumna(queryInterface, 'ordenes', 'cotizacion_cobro', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true,
      after: 'moneda_cobro'
    });

    await agregarColumna(queryInterface, 'tercerizaciones', 'costo_moneda', moneda());
    await agregarColumna(queryInterface, 'tercerizaciones', 'costo', precio());
    await agregarColumna(queryInterface, 'tercerizaciones', 'costo_cotizacion', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: true
    });
    await agregarColumna(queryInterface, 'tercerizaciones', 'costo_usd', precio());
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    for (const columna of ['costo_usd', 'costo_cotizacion', 'costo', 'costo_moneda']) {
      await queryInterface.removeColumn('tercerizaciones', columna);
    }
    await queryInterface.removeColumn('ordenes', 'cotizacion_cobro');
    await sequelize.query("UPDATE equipos_stock SET estado = 'disponible' WHERE estado = 'en_camino'");
    await queryInterface.changeColumn('equipos_stock', 'estado', {
      type: Sequelize.ENUM(...ESTADOS_STOCK_ANTES),
      allowNull: false,
      defaultValue: 'disponible'
    });
    await queryInterface.dropTable('inventario_movimientos');
    await queryInterface.dropTable('inventario_consumos');
    await sequelize.query('DELETE FROM venta_items WHERE equipo_stock_id IS NULL');
    await queryInterface.changeColumn('venta_items', 'equipo_stock_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    await queryInterface.removeColumn('venta_items', 'cantidad');
    await queryInterface.removeColumn('venta_items', 'articulo_id');
    await queryInterface.dropTable('orden_servicios');
    await queryInterface.dropTable('pase_items');
    await queryInterface.dropTable('inventario_entradas');
    await queryInterface.dropTable('pases');
    await queryInterface.dropTable('servicio_repuestos');
    await queryInterface.dropTable('articulos');
    await queryInterface.dropTable('inventario_categorias');
    await queryInterface.removeColumn('talleres', 'inventario_config');
  }
};
