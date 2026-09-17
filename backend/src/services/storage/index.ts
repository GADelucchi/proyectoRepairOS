import { env } from '../../config/env';
import { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';

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
