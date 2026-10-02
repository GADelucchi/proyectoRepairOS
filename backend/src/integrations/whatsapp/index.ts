import { WhatsAppProvider, NoneWhatsAppProvider } from './whatsapp.provider';

let instance: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (!instance) {
    // Cuando se integre un proveedor real, elegir según env.whatsapp.provider aquí.
    instance = new NoneWhatsAppProvider();
  }
  return instance;
}
