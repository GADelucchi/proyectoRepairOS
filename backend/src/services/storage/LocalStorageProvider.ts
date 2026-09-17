import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import { StorageProvider, UploadResult } from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;
  private readonly publicUrl: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), env.storage.local.uploadsDir);
    this.publicUrl = env.storage.local.publicUrl.replace(/\/$/, '');
  }

  /**
   * Resuelve una clave contra el directorio de subidas y verifica que no se
   * escape de él.
   *
   * Es la última línea de defensa contra un `..` en la clave: aunque quien la
   * arma se olvide de sanitizarla, acá no puede escribir fuera de `uploads/`.
   */
  private rutaSegura(key: string): string {
    const destino = path.resolve(this.baseDir, key);
    if (destino !== this.baseDir && !destino.startsWith(this.baseDir + path.sep)) {
      throw new Error('Clave de almacenamiento inválida');
    }
    return destino;
  }

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<UploadResult> {
    const filePath = this.rutaSegura(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return {
      url: `${this.publicUrl}/${key}`,
      storageKey: key
    };
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = this.rutaSegura(storageKey);
    await fs.rm(filePath, { force: true });
  }
}
