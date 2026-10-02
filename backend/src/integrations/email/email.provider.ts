export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
  /** false cuando falta la configuración: permite avisar en vez de fallar mudo. */
  estaConfigurado(): boolean;
}
