const ENTIDADES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapa texto para insertarlo en HTML.
 *
 * Los emails se arman con datos que carga el mostrador (nombre del cliente,
 * motivo de un pedido): sin escapar, un `<a href>` en un nombre termina como
 * link real en la bandeja del destinatario.
 */
export function escaparHtml(texto: string | null | undefined): string {
  return (texto ?? '').replace(/[&<>"']/g, (c) => ENTIDADES_HTML[c]);
}

/** Nombre y apellido en una sola cadena, tolerando faltantes. */
export function nombreCompleto(
  persona?: { nombre?: string | null; apellido?: string | null } | null
): string {
  return `${persona?.nombre ?? ''} ${persona?.apellido ?? ''}`.trim();
}
