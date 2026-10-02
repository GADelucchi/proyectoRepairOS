'use strict';

/**
 * Dos cambios que vienen del relevamiento de protección de datos personales.
 *
 * 1. La firma del cliente pasa a guardarse cifrada en la base.
 *
 *    Hasta ahora se subía como PNG al almacenamiento y lo único que quedaba en
 *    `ordenes` era su URL pública. Con el driver local eso significa un archivo
 *    servido por `express.static` sin autenticación: cualquiera con la URL veía
 *    la firma ológrafa del cliente. Ahora el PNG se cifra con AES-256-GCM (el
 *    mismo esquema que las claves de desbloqueo) y se guarda en la fila, y se
 *    entrega por un endpoint autenticado.
 *
 *    `firma_cliente_url` se conserva para las firmas viejas, que se siguen
 *    mostrando. `firma_cliente_at` registra cuándo se firmó, dato que importa
 *    como constancia del consentimiento.
 *
 * 2. `clientes.anonimizado_en` habilita el derecho de supresión.
 *
 *    Un cliente con órdenes no se puede borrar sin romper el respaldo contable,
 *    así que en su lugar se lo anonimiza: se sustituyen los datos
 *    identificatorios y se marca acá la fecha de la operación.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ordenes', 'firma_cliente_enc', {
      // El PNG cifrado en base64. Una firma ronda las decenas de KB.
      type: Sequelize.TEXT('medium'),
      allowNull: true,
      defaultValue: null
    });

    await queryInterface.addColumn('ordenes', 'firma_cliente_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // Las órdenes ya firmadas conservan su URL: se les data la firma con la
    // fecha de ingreso, que es cuando se firmó la recepción.
    await queryInterface.sequelize.query(
      'UPDATE ordenes SET firma_cliente_at = fecha_ingreso WHERE firma_cliente_url IS NOT NULL'
    );

    await queryInterface.addColumn('clientes', 'anonimizado_en', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('clientes', 'anonimizado_en');
    await queryInterface.removeColumn('ordenes', 'firma_cliente_at');
    await queryInterface.removeColumn('ordenes', 'firma_cliente_enc');
  }
};
