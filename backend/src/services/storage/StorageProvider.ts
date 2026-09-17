export interface UploadResult {
  url: string;
  storageKey: string;
}

export interface StorageProvider {
  /** Sube un archivo y devuelve la URL pública y la clave de almacenamiento. */
  upload(buffer: Buffer, key: string, mimeType: string): Promise<UploadResult>;
  /** Elimina un archivo previamente subido. */
  delete(storageKey: string): Promise<void>;
}
