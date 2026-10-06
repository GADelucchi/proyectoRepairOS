import { describe, expect, it } from 'vitest';
import { aNumero, formatearMonto, redondear } from './dinero';

describe('dinero', () => {
  it('acepta coma decimal y strings DECIMAL', () => {
    expect(aNumero('12,5')).toBe(12.5);
    expect(aNumero('1500.00')).toBe(1500);
    expect(aNumero('abc')).toBe(0);
    expect(aNumero(null)).toBe(0);
  });

  it('redondea a centavos', () => {
    expect(redondear(0.1 + 0.2)).toBe(0.3);
  });

  it('formatea en la moneda indicada, pesos por defecto', () => {
    const sinEspacios = (texto: string) => texto.replace(/\s/g, ' ');
    expect(sinEspacios(formatearMonto(1500))).toBe('$ 1.500');
    expect(sinEspacios(formatearMonto('120.50', 'USD'))).toBe('US$ 120,50');
    expect(formatearMonto(10, 'EUR')).toMatch(/EUR|€/);
  });
});
