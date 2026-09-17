import { Resend } from 'resend';
import { env } from '../../config/env';
import { EmailMessage, EmailProvider } from './EmailProvider';

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend | null;

  constructor() {
    this.client = env.email.resendApiKey ? new Resend(env.email.resendApiKey) : null;
  }

  estaConfigurado(): boolean {
    return this.client !== null;
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.client) {
      console.warn(
        '[email] RESEND_API_KEY no configurada, se omite el envío:',
        message.subject,
        '->',
        message.to
      );
      return;
    }
    const { error } = await this.client.emails.send({
      from: env.email.from,
      to: message.to,
      subject: message.subject,
      html: message.html
    });
    // Resend devuelve el error en la respuesta en lugar de lanzarlo.
    if (error) throw new Error(error.message);
  }
}
