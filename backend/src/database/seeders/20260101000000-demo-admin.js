'use strict';

const bcrypt = require('bcrypt');

const ADMIN_EMAIL = 'admin@repairos.local';
const SUCURSAL_NOMBRE = 'Sucursal Central';
const TALLER_NOMBRE = 'Taller Demo';

/**
 * Datos iniciales: un taller con su administrador y una sucursal.
 *
 * El seeder es idempotente: se puede volver a correr sin romper nada, porque
 * inserta solamente lo que todavía no existe (el email de usuario es único).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const ahora = new Date();

    // El taller es el dueño de todo lo demás, así que va primero.
    const [tallerExistente] = await sequelize.query('SELECT id FROM talleres WHERE nombre = ? LIMIT 1', {
      replacements: [TALLER_NOMBRE],
      type: sequelize.QueryTypes.SELECT
    });

    let tallerId = tallerExistente?.id;
    if (!tallerId) {
      await queryInterface.bulkInsert('talleres', [
        { nombre: TALLER_NOMBRE, activo: true, created_at: ahora, updated_at: ahora }
      ]);
      const [creado] = await sequelize.query('SELECT id FROM talleres WHERE nombre = ? LIMIT 1', {
        replacements: [TALLER_NOMBRE],
        type: sequelize.QueryTypes.SELECT
      });
      tallerId = creado.id;

      const graciaHasta = new Date(ahora);
      graciaHasta.setMonth(graciaHasta.getMonth() + 1);
      await queryInterface.bulkInsert('suscripciones', [
        {
          taller_id: tallerId,
          plan_id: null,
          estado: 'prueba',
          gracia_hasta: graciaHasta.toISOString().slice(0, 10),
          periodo_fin: null,
          created_at: ahora,
          updated_at: ahora
        }
      ]);
    }

    const [adminExistente] = await sequelize.query('SELECT id FROM users WHERE email = ? LIMIT 1', {
      replacements: [ADMIN_EMAIL],
      type: sequelize.QueryTypes.SELECT
    });

    let adminId = adminExistente?.id;
    if (!adminId) {
      const passwordHash = await bcrypt.hash('Admin123!', 10);
      await queryInterface.bulkInsert('users', [
        {
          taller_id: tallerId,
          nombre: 'Admin',
          apellido: 'Principal',
          email: ADMIN_EMAIL,
          password_hash: passwordHash,
          rol: 'admin',
          activo: true,
          created_at: ahora,
          updated_at: ahora
        }
      ]);
      const [creado] = await sequelize.query('SELECT id FROM users WHERE email = ? LIMIT 1', {
        replacements: [ADMIN_EMAIL],
        type: sequelize.QueryTypes.SELECT
      });
      adminId = creado.id;
      console.log(`  → Usuario admin creado: ${ADMIN_EMAIL} / Admin123!  (CAMBIALA en el primer ingreso)`);
    } else {
      console.log('  → El usuario admin ya existe, se omite.');
    }

    const [sucursalExistente] = await sequelize.query(
      'SELECT id FROM sucursales WHERE nombre = ? AND taller_id = ? LIMIT 1',
      { replacements: [SUCURSAL_NOMBRE, tallerId], type: sequelize.QueryTypes.SELECT }
    );

    let sucursalId = sucursalExistente?.id;
    if (!sucursalId) {
      await queryInterface.bulkInsert('sucursales', [
        {
          taller_id: tallerId,
          nombre: SUCURSAL_NOMBRE,
          direccion: 'Sin especificar',
          telefono: null,
          activo: true,
          created_at: ahora,
          updated_at: ahora
        }
      ]);
      const [creada] = await sequelize.query(
        'SELECT id FROM sucursales WHERE nombre = ? AND taller_id = ? LIMIT 1',
        { replacements: [SUCURSAL_NOMBRE, tallerId], type: sequelize.QueryTypes.SELECT }
      );
      sucursalId = creada.id;
    }

    const [permisoExistente] = await sequelize.query(
      'SELECT id FROM usuario_sucursales WHERE usuario_id = ? AND sucursal_id = ? LIMIT 1',
      { replacements: [adminId, sucursalId], type: sequelize.QueryTypes.SELECT }
    );

    if (!permisoExistente) {
      await queryInterface.bulkInsert('usuario_sucursales', [
        { usuario_id: adminId, sucursal_id: sucursalId, created_at: ahora, updated_at: ahora }
      ]);
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(
      `DELETE us FROM usuario_sucursales us
         JOIN users u ON u.id = us.usuario_id
        WHERE u.email = ?`,
      { replacements: [ADMIN_EMAIL] }
    );
    await queryInterface.bulkDelete('users', { email: ADMIN_EMAIL });
    await queryInterface.bulkDelete('sucursales', { nombre: SUCURSAL_NOMBRE });
    await sequelize.query(
      'DELETE s FROM suscripciones s JOIN talleres t ON t.id = s.taller_id WHERE t.nombre = ?',
      {
        replacements: [TALLER_NOMBRE]
      }
    );
    await queryInterface.bulkDelete('talleres', { nombre: TALLER_NOMBRE });
  }
};
