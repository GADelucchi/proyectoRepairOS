import { qrComoImagen } from '@/features/equipos/qr';
import type { EquipoStock } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { escaparHtml, imprimirHtml } from '@/shared/utils/imprimir';
import { detalleCondicion, etiquetaNumero, textoAlmacenamiento } from './stock-form';

/**
 * Etiqueta de un equipo del stock.
 *
 * Mismo tamaño que la de reparación (50 × 30 mm), así sale del mismo rollo, pero
 * con la franja negra "STOCK": un equipo en venta no se confunde con el de un
 * cliente. El QR es un link a su ficha en la app, como el de reparación: sirve
 * con cualquier cámara y con un lector 2D, y solo lo abre alguien del taller.
 */

/** Link a la ficha del equipo del stock, con el dominio desde el que se usa la app. */
export function urlDeEquipoStock(id: number): string {
  return `${window.location.origin}/stock/${id}`;
}

/**
 * Id del equipo de un QR de stock leído, o null si no es una etiqueta de stock.
 *
 * Se acepta cualquier dominio, como en la de reparación: la API solo devuelve el
 * equipo si es del taller de quien escanea.
 */
export function idDeStockEnQr(texto: string): number | null {
  try {
    const coincidencia = new URL(texto.trim()).pathname.match(/^\/stock\/(\d+)\/?$/);
    return coincidencia ? Number(coincidencia[1]) : null;
  } catch {
    return null;
  }
}

export interface OpcionesEtiquetaStock {
  /** El precio cambia seguido: va solo si se pide. */
  conPrecio?: boolean;
}

type DatosEtiqueta = Pick<
  EquipoStock,
  | 'numero'
  | 'marca'
  | 'modelo'
  | 'almacenamientoGb'
  | 'color'
  | 'condicion'
  | 'bateria'
  | 'numeroSerie'
  | 'precio'
  | 'monedaPrecio'
>;

/** El HTML de la etiqueta, con el QR ya convertido en imagen. */
export function htmlDeEtiquetaStock(
  equipo: DatosEtiqueta,
  qr: string,
  { conPrecio = false }: OpcionesEtiquetaStock = {}
): string {
  const detalle = [textoAlmacenamiento(equipo.almacenamientoGb), equipo.color].filter(Boolean).join(' · ');
  const precio =
    conPrecio && equipo.precio != null && equipo.monedaPrecio
      ? formatearMonto(equipo.precio, equipo.monedaPrecio)
      : null;
  const serie = equipo.numeroSerie ?? '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Etiqueta ${escaparHtml(etiquetaNumero(equipo.numero))}</title>
<style>
  @page { size: 50mm 30mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 50mm; height: 30mm; padding: 1.5mm;
    display: flex; align-items: center; gap: 1.5mm;
    font-family: Arial, Helvetica, sans-serif; color: #000;
    overflow: hidden;
    /* Sin esto el navegador no imprime el fondo negro de la franja. */
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  img { width: 24mm; height: 24mm; flex: none; }
  .datos { flex: 1; min-width: 0; font-size: 6.5pt; line-height: 1.25; }
  .franja {
    display: flex; justify-content: space-between; gap: 1mm;
    background: #000; color: #fff; font-weight: bold; font-size: 7pt;
    padding: 0.3mm 1mm; margin-bottom: 0.8mm; border-radius: 0.6mm;
  }
  .equipo { font-weight: bold; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .precio { margin-top: 0.6mm; font-size: 9pt; font-weight: bold; white-space: nowrap; }
  .serie { margin-top: 0.8mm; font-family: 'Courier New', monospace; font-weight: bold; word-break: break-all; }
</style>
</head>
<body>
  <img src="${qr}" alt="" />
  <div class="datos">
    <div class="franja"><span>STOCK</span><span>${escaparHtml(etiquetaNumero(equipo.numero))}</span></div>
    <div class="equipo">${escaparHtml(`${equipo.marca} ${equipo.modelo}`)}</div>
    ${detalle ? `<div>${escaparHtml(detalle)}</div>` : ''}
    <div>${escaparHtml(detalleCondicion(equipo))}</div>
    ${precio ? `<div class="precio">${escaparHtml(precio)}</div>` : ''}
    ${serie ? `<div class="serie">S/N ${escaparHtml(serie)}</div>` : ''}
  </div>
</body>
</html>`;
}

/** Abre el diálogo de impresión con la etiqueta del equipo. */
export async function imprimirEtiquetaStock(
  equipo: EquipoStock,
  opciones: OpcionesEtiquetaStock = {}
): Promise<void> {
  const qr = await qrComoImagen(urlDeEquipoStock(equipo.id));
  await imprimirHtml(htmlDeEtiquetaStock(equipo, qr, opciones));
}
