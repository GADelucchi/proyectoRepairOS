'use strict';

/**
 * Pasos de migración que se pueden repetir.
 *
 * En MySQL los cambios de estructura (agregar una columna, crear una tabla) no
 * se deshacen si la migración falla a mitad de camino: quedan hechos, pero la
 * migración no se anota en `SequelizeMeta`. Al reintentar, el primer paso choca
 * con lo que ya está ("Duplicate column name"). Con estos, cada paso se saltea
 * si ya se había aplicado y la migración termina lo que le faltaba.
 *
 * Vive fuera de `migrations/` porque sequelize-cli corre como migración todo lo
 * que haya en esa carpeta.
 */

async function agregarColumna(queryInterface, tabla, columna, definicion) {
  const columnas = await queryInterface.describeTable(tabla);
  if (!columnas[columna]) await queryInterface.addColumn(tabla, columna, definicion);
}

async function crearTabla(queryInterface, tabla, definicion) {
  const tablas = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
  if (!tablas.includes(tabla)) await queryInterface.createTable(tabla, definicion);
}

/** El índice tiene que tener `name`: es lo que se busca para saber si ya existe. */
async function agregarIndice(queryInterface, tabla, campos, opciones) {
  const indices = await queryInterface.showIndex(tabla);
  if (!indices.some((i) => i.name === opciones.name)) await queryInterface.addIndex(tabla, campos, opciones);
}

module.exports = { agregarColumna, crearTabla, agregarIndice };
