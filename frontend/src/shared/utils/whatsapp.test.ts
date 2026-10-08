import { describe, expect, it } from 'vitest';
import { linkWhatsApp, telefonoParaWhatsApp } from './whatsapp';

describe('telefonoParaWhatsApp', () => {
  it('arma celulares argentinos con 549 y sin 0 ni 15', () => {
    expect(telefonoParaWhatsApp('0221 15 555-1234', 'AR')).toBe('5492215551234');
    expect(telefonoParaWhatsApp('11 15 4444-5555', 'AR')).toBe('5491144445555');
    expect(telefonoParaWhatsApp('221 555-1234', 'AR')).toBe('5492215551234');
    expect(telefonoParaWhatsApp('+54 221 555 1234', 'AR')).toBe('5492215551234');
    expect(telefonoParaWhatsApp('+54 9 221 555 1234', 'AR')).toBe('5492215551234');
  });

  it('agrega el prefijo del país del taller si el número no lo trae', () => {
    expect(telefonoParaWhatsApp('099 123 456', 'UY')).toBe('59899123456');
    expect(telefonoParaWhatsApp('9 8765 4321', 'CL')).toBe('56987654321');
    expect(telefonoParaWhatsApp('+598 99 123 456', 'AR')).toBe('59899123456');
  });

  it('descarta lo que no es un teléfono', () => {
    expect(telefonoParaWhatsApp('', 'AR')).toBeNull();
    expect(telefonoParaWhatsApp('123', 'AR')).toBeNull();
    expect(telefonoParaWhatsApp(null, 'AR')).toBeNull();
  });
});

describe('linkWhatsApp', () => {
  it('codifica el mensaje', () => {
    expect(linkWhatsApp('5492215551234', 'Hola, ¿cómo va?')).toBe(
      'https://wa.me/5492215551234?text=Hola%2C%20%C2%BFc%C3%B3mo%20va%3F'
    );
  });
});
