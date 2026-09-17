import { EmailProvider } from './EmailProvider';
import { ResendEmailProvider } from './ResendEmailProvider';

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!instance) {
    instance = new ResendEmailProvider();
  }
  return instance;
}
