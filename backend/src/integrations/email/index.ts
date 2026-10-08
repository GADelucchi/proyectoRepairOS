import { EmailProvider } from './email.provider';
import { ResendEmailProvider } from './resend-email.provider';

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!instance) {
    instance = new ResendEmailProvider();
  }
  return instance;
}

/** Reemplaza el proveedor (los tests de integración capturan los emails en memoria). */
export function setEmailProvider(proveedor: EmailProvider | null): void {
  instance = proveedor;
}
