/** Para meter texto del usuario en el HTML de una etiqueta. */
export const escaparHtml = (texto: string) =>
  texto.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

/**
 * Abre el diálogo de impresión con un documento suelto (una etiqueta).
 *
 * Se imprime desde un iframe oculto en vez de una ventana nueva: en la app
 * instalada (PWA) `window.open` saca al usuario al navegador.
 */
export async function imprimirHtml(html: string): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

  await new Promise<void>((listo) => {
    iframe.onload = () => listo();
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });

  const ventana = iframe.contentWindow!;
  // Se quita después de imprimir; el timeout cubre a los navegadores que no avisan.
  const quitar = () => setTimeout(() => iframe.remove(), 500);
  ventana.addEventListener('afterprint', quitar, { once: true });
  setTimeout(quitar, 60_000);
  ventana.focus();
  ventana.print();
}
