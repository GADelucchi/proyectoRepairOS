'use strict';

const { randomInt } = require('crypto');

/** Sin 0/O ni 1/I/L: el código se dicta por teléfono y se tipea a mano. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const codigo = () => Array.from({ length: 10 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/**
 * - `talleres.pais`: define la moneda por defecto y el prefijo de WhatsApp.
 * - `ordenes.codigo_seguimiento`: el link público con el que el cliente ve el
 *   estado de su equipo. Es aleatorio (no el número de orden) para que nadie
 *   pueda recorrer las órdenes de un taller cambiando un número.
 * - `users.email_verificado_en` y `tokens_usuario`: verificación de email y
 *   recuperación de contraseña. Los usuarios existentes quedan verificados.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('talleres', 'pais', {
      type: Sequelize.STRING(2),
      allowNull: false,
      defaultValue: 'AR'
    });

    await queryInterface.addColumn('ordenes', 'codigo_seguimiento', {
      type: Sequelize.STRING(20),
      allowNull: true
    });
    const [ordenes] = await queryInterface.sequelize.query('SELECT id FROM ordenes');
    for (const { id } of ordenes) {
      await queryInterface.sequelize.query('UPDATE ordenes SET codigo_seguimiento = ? WHERE id = ?', {
        replacements: [codigo(), id]
      });
    }
    await queryInterface.addIndex('ordenes', ['codigo_seguimiento'], {
      name: 'uq_ordenes_codigo_seguimiento',
      unique: true
    });

    await queryInterface.addColumn('users', 'email_verificado_en', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await queryInterface.sequelize.query('UPDATE users SET email_verificado_en = created_at');

    await queryInterface.createTable('tokens_usuario', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      // 'restablecer_password' | 'verificar_email'
      tipo: { type: Sequelize.STRING(30), allowNull: false },
      // Solo el hash: quien lea la base no puede usar los links pendientes.
      token_hash: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
      expira_en: { type: Sequelize.DATE, allowNull: false },
      usado_en: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tokens_usuario');
    await queryInterface.removeColumn('users', 'email_verificado_en');
    await queryInterface.removeIndex('ordenes', 'uq_ordenes_codigo_seguimiento');
    await queryInterface.removeColumn('ordenes', 'codigo_seguimiento');
    await queryInterface.removeColumn('talleres', 'pais');
  }
};
