'use strict';

const { randomInt } = require('crypto');

/** Mismo alfabeto que los códigos de seguimiento: sin caracteres que se confundan. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const codigo = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/**
 * Código público de cada taller: arma el link del portal donde sus clientes
 * consultan sus datos, órdenes y cuenta corriente (`/cliente/:codigo`).
 *
 * Es aleatorio y no el id, para que nadie pueda recorrer los talleres cambiando
 * un número. Queda nullable: los talleres creados por scripts que no lo cargan
 * lo reciben la primera vez que se pide (ver `codigoPublicoDe`).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('talleres', 'codigo_publico', {
      type: Sequelize.STRING(12),
      allowNull: true
    });
    const [talleres] = await queryInterface.sequelize.query('SELECT id FROM talleres');
    for (const { id } of talleres) {
      await queryInterface.sequelize.query('UPDATE talleres SET codigo_publico = ? WHERE id = ?', {
        replacements: [codigo(), id]
      });
    }
    await queryInterface.addIndex('talleres', ['codigo_publico'], {
      name: 'uq_talleres_codigo_publico',
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('talleres', 'uq_talleres_codigo_publico');
    await queryInterface.removeColumn('talleres', 'codigo_publico');
  }
};
