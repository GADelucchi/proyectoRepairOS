'use strict';

/**
 * El límite del plan cuenta usuarios (el dueño incluido), no técnicos: los
 * textos de los planes lo dicen así, igual que la landing.
 *
 * @type {import('sequelize-cli').Migration}
 */
const TEXTOS = {
  taller: ['Para un local con hasta 2 técnicos.', 'Para un local: 1 sucursal y hasta 2 usuarios.'],
  cadena: [
    'Hasta 3 sucursales con técnicos ilimitados y permisos por sucursal.',
    'Hasta 3 sucursales con usuarios ilimitados y permisos por sucursal.'
  ]
};

module.exports = {
  async up(queryInterface) {
    for (const [codigo, [, nuevo]] of Object.entries(TEXTOS)) {
      await queryInterface.bulkUpdate('planes', { descripcion: nuevo }, { codigo });
    }
  },

  async down(queryInterface) {
    for (const [codigo, [anterior]] of Object.entries(TEXTOS)) {
      await queryInterface.bulkUpdate('planes', { descripcion: anterior }, { codigo });
    }
  }
};
