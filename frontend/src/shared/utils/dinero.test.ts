import { describe, expect, it } from 'vitest';
import { aNumero, redondear } from './dinero';

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
});
