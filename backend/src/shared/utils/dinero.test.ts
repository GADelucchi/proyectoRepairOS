import { describe, expect, it } from 'vitest';
import { enDolares, textoCotizacion } from './dinero';

describe('enDolares', () => {
  it('deja igual lo que ya está en dólares, aunque venga una cotización', () => {
    expect(enDolares('900.00', 'USD', null)).toBe(900);
    expect(enDolares(900, 'USD', 1200)).toBe(900);
  });

  it('divide por la cotización del día', () => {
    expect(enDolares('520000.00', 'ARS', '1150.0000')).toBe(452.17);
  });

  it('sin cotización no inventa un valor', () => {
    expect(() => enDolares(520000, 'ARS', null)).toThrow();
  });
});

describe('textoCotizacion', () => {
  it('muestra cuántos pesos vale la moneda extranjera de la deuda', () => {
    expect(textoCotizacion('USD', 100, 'ARS', 120000)).toBe('1 USD = 1200 ARS');
  });

  it('se lee igual cuando la deuda es en pesos y se paga en dólares', () => {
    expect(textoCotizacion('ARS', 120000, 'USD', 100)).toBe('1 USD = 1200 ARS');
  });

  it('entre dos monedas extranjeras toma como base la de la deuda', () => {
    expect(textoCotizacion('USD', 100, 'EUR', 90)).toBe('1 USD = 0.9 EUR');
  });
});
