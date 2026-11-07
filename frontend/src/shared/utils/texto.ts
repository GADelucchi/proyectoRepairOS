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

/**
 * Pasa a mayúsculas lo que se escribe en un campo, tenga el teclado como tenga
 * las mayúsculas. Cambia el campo en el lugar para que el cursor no salte al
 * final si se corrige en el medio.
 */
export function aMayusculas(input: HTMLInputElement | HTMLTextAreaElement): string {
  const valor = input.value.toUpperCase();
  if (valor !== input.value) {
    const { selectionStart, selectionEnd } = input;
    input.value = valor;
    input.setSelectionRange(selectionStart, selectionEnd);
  }
  return valor;
}
