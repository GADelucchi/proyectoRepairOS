'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Generar valores para equipos sin número de serie
    const equipos = await queryInterface.sequelize.query(
      'SELECT id FROM equipos WHERE numero_serie IS NULL OR numero_serie = ""',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const equipo of equipos) {
      const randomSerie = `SN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      await queryInterface.sequelize.query('UPDATE equipos SET numero_serie = ? WHERE id = ?', {
        replacements: [randomSerie, equipo.id]
      });
    }

    // Ahora cambiar la columna a NOT NULL
    await queryInterface.changeColumn('equipos', 'numero_serie', {
      type: Sequelize.STRING(150),
      allowNull: false
    });

    // Agregar UNIQUE constraint
    await queryInterface.addConstraint('equipos', {
      fields: ['numero_serie'],
      type: 'unique',
      name: 'uq_equipos_numero_serie'
    });
  },

  async down(queryInterface) {
    // Remover UNIQUE constraint
    await queryInterface.removeConstraint('equipos', 'uq_equipos_numero_serie');

    // Volver a nullable
    await queryInterface.changeColumn('equipos', 'numero_serie', {
      type: queryInterface.sequelize.Sequelize.STRING(150),
      allowNull: true
    });
  }
};
