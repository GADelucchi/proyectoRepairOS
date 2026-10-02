import { env } from '../../config/env';
import { StorageProvider } from './storage.provider';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

let instance: StorageProvider | null = null;

/**
 * Devuelve el proveedor de almacenamiento configurado vía STORAGE_DRIVER (local | s3).
 * Permite cambiar de proveedor sin tocar el resto del código (equipos, órdenes, firmas, etc.).
 */
export function getStorageProvider(): StorageProvider {
  if (instance) return instance;
  instance = env.storage.driver === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
  return instance;
}
