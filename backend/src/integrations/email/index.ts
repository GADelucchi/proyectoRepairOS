import { EmailProvider } from './email.provider';
import { ResendEmailProvider } from './resend-email.provider';

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!instance) {
    instance = new ResendEmailProvider();
  }
  return instance;
}
