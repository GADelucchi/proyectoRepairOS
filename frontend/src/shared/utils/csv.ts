/**
 * Descarga una tabla como CSV para abrirla en Excel. Va con BOM y `;` como
 * separador: es lo que Excel en español espera para respetar acentos y columnas.
 */
export function descargarCsv(
  nombre: string,
  encabezados: string[],
  filas: (string | number | null)[][]
): void {
  const celda = (valor: string | number | null) => {
    const texto = valor == null ? '' : String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const contenido = [encabezados, ...filas].map((fila) => fila.map(celda).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombre}.csv`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
