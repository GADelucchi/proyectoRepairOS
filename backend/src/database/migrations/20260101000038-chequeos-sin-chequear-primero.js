'use strict';

const ANTERIORES = ['Sí', 'No', 'Sin revisar'];
const NUEVAS = ['Sin chequear', 'Sí', 'No'];

const etiquetas = (opciones) =>
  (typeof opciones === 'string' ? JSON.parse(opciones) : (opciones ?? [])).map((o) => o.etiqueta);
const iguales = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Pasa los chequeos con exactamente las opciones `desde` a las opciones `hacia`. */
async function reemplazar(queryInterface, desde, hacia) {
  const { sequelize } = queryInterface;
  const [filas] = await sequelize.query('SELECT id, opciones FROM chequeo_personalizados');
  const json = JSON.stringify(hacia.map((etiqueta) => ({ etiqueta })));
  for (const fila of filas) {
    if (!iguales(etiquetas(fila.opciones), desde)) continue;
    await sequelize.query('UPDATE chequeo_personalizados SET opciones = ? WHERE id = ?', {
      replacements: [json, fila.id]
    });
  }
}

/**
 * La primera opción de cada chequeo pasa a ser la respuesta que queda marcada
 * al crear una orden.
 *
 * Los chequeos que siguen con las opciones de fábrica (Sí / No / Sin revisar)
 * pasan a "Sin chequear / Sí / No": si quedaran así, cada orden nueva arrancaría
 * con todo en "Sí" sin que nadie lo haya revisado. Los que el taller
 * personalizó no se tocan; su primera opción se cambia en Configuración.
 *
 * Las órdenes ya creadas guardan sus opciones aparte y no cambian.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await reemplazar(queryInterface, ANTERIORES, NUEVAS);
  },

  async down(queryInterface) {
    await reemplazar(queryInterface, NUEVAS, ANTERIORES);
  }
};
