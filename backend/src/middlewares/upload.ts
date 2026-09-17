import multer from 'multer';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ARCHIVOS = 10;

/**
 * Tipos de imagen aceptados y la extensión con la que se guardan.
 *
 * La extensión sale de acá y nunca del nombre del archivo: `originalname` lo
 * controla quien sube y puede contener barras y `..`, que al armar la ruta de
 * destino permiten escribir fuera del directorio de subidas.
 */
export const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

/** Extensión segura para un mime ya validado. */
export function extensionPara(mimetype: string): string {
  return MIME_PERMITIDOS[mimetype] ?? 'bin';
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_ARCHIVOS },
  fileFilter: (_req, file, cb) => {
    if (!MIME_PERMITIDOS[file.mimetype]) {
      cb(new Error('Formato de imagen no soportado. Use JPG, PNG o WEBP.'));
      return;
    }
    cb(null, true);
  }
});
