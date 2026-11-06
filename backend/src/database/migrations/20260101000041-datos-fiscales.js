'use strict';

const { agregarColumna } = require('../migraciones-seguras');

/**
 * Datos para facturar. Cada taller carga los suyos en Configuración y factura con
 * su propio CUIT. La condición frente al IVA del cliente es obligatoria en cada
 * pedido de CAE (RG 5616): quien no la tiene cargada es consumidor final.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await agregarColumna(queryInterface, 'talleres', 'razon_social', {
      type: Sequelize.STRING(150),
      allowNull: true
    });
    await agregarColumna(queryInterface, 'talleres', 'cuit', { type: Sequelize.STRING(11), allowNull: true });
    await agregarColumna(queryInterface, 'talleres', 'condicion_iva', {
      type: Sequelize.STRING(30),
      allowNull: true
    });
    await agregarColumna(queryInterface, 'talleres', 'domicilio_fiscal', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await agregarColumna(queryInterface, 'talleres', 'inicio_actividades', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
    await agregarColumna(queryInterface, 'talleres', 'ingresos_brutos', {
      type: Sequelize.STRING(30),
      allowNull: true
    });
    await agregarColumna(queryInterface, 'talleres', 'punto_venta', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await agregarColumna(queryInterface, 'clientes', 'condicion_iva', {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: 'consumidor_final'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'condicion_iva');
    for (const columna of [
      'punto_venta',
      'ingresos_brutos',
      'inicio_actividades',
      'domicilio_fiscal',
      'condicion_iva',
      'cuit',
      'razon_social'
    ]) {
      await queryInterface.removeColumn('talleres', columna);
    }
  }
};
