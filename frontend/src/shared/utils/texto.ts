/** Nombre y apellido en una sola cadena, tolerando faltantes. */
export function nombreCompleto(
  persona?: { nombre?: string | null; apellido?: string | null } | null
): string {
  return `${persona?.nombre ?? ''} ${persona?.apellido ?? ''}`.trim();
}

/** Recorta y convierte "" en null, que es como la API guarda los campos vacíos. */
export function textoONull(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}
