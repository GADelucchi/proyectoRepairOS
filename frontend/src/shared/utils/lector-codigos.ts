import type { BarcodeDetector } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

/**
 * Lector de códigos de barras y QR con la cámara.
 *
 * Safari (iPhone y iPad) no trae lector de códigos, así que se usa ZXing en
 * WebAssembly en todos lados: lee igual en cualquier dispositivo. El `.wasm`
 * (~1 MB) se sirve desde la app, no de un CDN, y se descarga recién la primera
 * vez que se abre el lector.
 *
 * Los formatos son los de las etiquetas de las cajas: Code 128 (IMEI y serial
 * en casi todas), EAN/UPC (el código del producto) y QR / Data Matrix.
 */
const FORMATOS = [
  'code_128',
  'code_39',
  'code_93',
  'ean_13',
  'ean_8',
  'upc_a',
  'itf',
  'qr_code',
  'data_matrix'
];

let detector: Promise<BarcodeDetector> | null = null;

export function obtenerDetector(): Promise<BarcodeDetector> {
  detector ??= import('barcode-detector/ponyfill')
    .then(({ BarcodeDetector, prepareZXingModule }) => {
      prepareZXingModule({
        overrides: {
          locateFile: (path: string, prefijo: string) => (path.endsWith('.wasm') ? wasmUrl : prefijo + path)
        }
      });
      return new BarcodeDetector({ formats: FORMATOS as never });
    })
    .catch((err) => {
      // Que el próximo intento vuelva a probar (por ejemplo, si falló la red).
      detector = null;
      throw err;
    });
  return detector;
}

/** El primer código que se ve en la imagen, o null. */
export async function leerCodigo(fuente: ImageBitmapSource): Promise<string | null> {
  const lector = await obtenerDetector();
  const codigos = await lector.detect(fuente);
  return codigos.find((c) => c.rawValue.trim())?.rawValue.trim() ?? null;
}
