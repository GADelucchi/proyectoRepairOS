import QRCode from 'qrcode';
import type { Equipo } from '@/shared/types';
import { describirEquipo } from './equipo-form';

/**
 * QR de la etiqueta que se pega en el equipo.
 *
 * El QR es un link a la ficha del equipo en la app. Así sirve con cualquier
 * cámara de celular (abre el navegador) y con el lector de la app. Ver la ficha
 * exige sesión del taller: un tercero que lo escanee solo llega al login.
 */

/** Link a la ficha del equipo, con el dominio desde el que se usa la app. */
export function urlDeEquipo(id: number): string {
  return `${window.location.origin}/equipos/${id}`;
}

/**
 * Id del equipo de un QR leído, o null si no es una etiqueta de equipo.
 *
 * Se acepta cualquier dominio: una etiqueta impresa desde otra instalación (o
 * desde desarrollo) igual apunta a `/equipos/:id`, y la API solo devuelve el
 * equipo si es del taller de quien está escaneando.
 */
export function idDeEquipoEnQr(texto: string): number | null {
  try {
    const coincidencia = new URL(texto.trim()).pathname.match(/^\/equipos\/(\d+)\/?$/);
    return coincidencia ? Number(coincidencia[1]) : null;
  } catch {
    return null;
  }
}

/** SVG del QR como data URL, listo para un `<img>`. */
export async function qrComoImagen(texto: string): Promise<string> {
  const svg = await QRCode.toString(texto, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const escaparHtml = (texto: string) =>
  texto.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );

/**
 * Etiqueta de 50 × 30 mm para impresoras térmicas (Zebra, Brother, Dymo): el QR
 * a la izquierda y, al lado, el equipo y su número de serie para quien no tenga
 * un lector a mano.
 */
function htmlDeEtiqueta(equipo: Equipo, qr: string): string {
  const tipo = equipo.tipoEquipo?.nombre ?? '';
  const serie = equipo.numeroSerie ?? '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Etiqueta ${escaparHtml(serie)}</title>
<style>
  @page { size: 50mm 30mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 50mm; height: 30mm; padding: 1.5mm;
    display: flex; align-items: center; gap: 1.5mm;
    font-family: Arial, Helvetica, sans-serif; color: #000;
    overflow: hidden;
  }
  img { width: 27mm; height: 27mm; flex: none; }
  .datos { min-width: 0; font-size: 6.5pt; line-height: 1.25; }
  .tipo { font-weight: bold; text-transform: uppercase; }
  .equipo { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .serie { margin-top: 1mm; font-family: 'Courier New', monospace; font-weight: bold; word-break: break-all; }
</style>
</head>
<body>
  <img src="${qr}" alt="" />
  <div class="datos">
    ${tipo ? `<div class="tipo">${escaparHtml(tipo)}</div>` : ''}
    <div class="equipo">${escaparHtml(describirEquipo({ ...equipo, numeroSerie: null }))}</div>
    ${serie ? `<div class="serie">S/N ${escaparHtml(serie)}</div>` : ''}
  </div>
</body>
</html>`;
}

/**
 * Abre el diálogo de impresión con la etiqueta sola.
 *
 * Se imprime desde un iframe oculto en vez de una ventana nueva: en la app
 * instalada (PWA) `window.open` saca al usuario al navegador.
 */
export async function imprimirEtiqueta(equipo: Equipo): Promise<void> {
  const qr = await qrComoImagen(urlDeEquipo(equipo.id));
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

  await new Promise<void>((listo) => {
    iframe.onload = () => listo();
    iframe.srcdoc = htmlDeEtiqueta(equipo, qr);
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
