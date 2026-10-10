import { randomUUID } from 'crypto';
import { Orden, OrdenImagen } from '../../models';
import { getStorageProvider } from '../../integrations/storage';
import { errores } from '../../shared/http/http-error';
import { extensionPara } from '../../shared/middlewares/upload.middleware';
import { encryptBuffer } from '../../shared/security/encryption';

const FIRMA_PNG = /^data:image\/png;base64,/;
const CABECERA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Fotos y firma de una orden. */

export async function subirImagenes(
  orden: Orden,
  archivos: Pick<Express.Multer.File, 'buffer' | 'mimetype'>[],
  descripcion: string | null
): Promise<OrdenImagen[]> {
  const storage = getStorageProvider();
  return Promise.all(
    archivos.map(async (archivo) => {
      // La extensión sale del mime que ya validó multer, nunca del nombre del
      // archivo: `originalname` puede traer `../` y escaparse del directorio.
      const clave = `ordenes/${orden.id}/${randomUUID()}.${extensionPara(archivo.mimetype)}`;
      const { url, storageKey } = await storage.upload(archivo.buffer, clave, archivo.mimetype);
      return OrdenImagen.create({ ordenId: orden.id, url, storageKey, descripcion });
    })
  );
}

export async function eliminarImagen(orden: Orden, imagenId: number): Promise<void> {
  const imagen = await OrdenImagen.findOne({ where: { id: imagenId, ordenId: orden.id } });
  if (!imagen) throw errores.noEncontrado('Imagen');

  await imagen.destroy();
  await getStorageProvider().delete(imagen.storageKey);
}

/** Una vez firmada no se reemplaza, porque es la constancia de lo que el cliente aceptó. */
export function exigirSinFirma(orden: Orden): void {
  if (orden.firmaClienteAt) throw errores.conflicto('La orden ya tiene la firma del cliente');
}

/**
 * Guarda la firma del cliente, cifrada en la fila de la orden.
 *
 * No va al almacenamiento público: es un dato personal y con el driver local
 * quedaba servida por `express.static` a quien tuviera la URL.
 */
export async function guardarFirma(orden: Orden, firmaBase64: string): Promise<Date> {
  exigirSinFirma(orden);
  const png = Buffer.from(firmaBase64.replace(FIRMA_PNG, ''), 'base64');
  if (!png.subarray(0, CABECERA_PNG.length).equals(CABECERA_PNG)) {
    throw errores.solicitudInvalida('La firma tiene que ser una imagen PNG');
  }

  const firmadaEn = new Date();
  await orden.update({ firmaClienteEnc: encryptBuffer(png), firmaClienteAt: firmadaEn });
  return firmadaEn;
}
