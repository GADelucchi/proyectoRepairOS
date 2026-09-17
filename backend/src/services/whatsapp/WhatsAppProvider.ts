export interface WhatsAppMessage {
  to: string;
  body: string;
}

export interface WhatsAppProvider {
  send(message: WhatsAppMessage): Promise<void>;
  /** false cuando falta la configuración: permite avisar en vez de fallar mudo. */
  estaConfigurado(): boolean;
}

/**
 * Implementación "stub": no envía nada todavía, solo deja registro.
 * Reemplazar por una integración real (Twilio, Meta Cloud API, etc.) cuando se decida
 * el proveedor de WhatsApp, sin modificar el resto del sistema (usa la misma interfaz).
 */
export class NoneWhatsAppProvider implements WhatsAppProvider {
  estaConfigurado(): boolean {
    return false;
  }

  async send(message: WhatsAppMessage): Promise<void> {
    console.warn('[whatsapp] Integración no configurada todavía. Mensaje pendiente para', message.to);
  }
}
