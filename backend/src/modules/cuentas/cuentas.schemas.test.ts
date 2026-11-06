import { describe, expect, it } from 'vitest';
import { registrarCobroSchema } from './cuentas.schemas';

describe('registrarCobroSchema', () => {
  it('acepta un cobro en la moneda de la deuda', () => {
    expect(registrarCobroSchema.safeParse({ monto: 100, moneda: 'USD' }).success).toBe(true);
  });

  it('acepta pagar una deuda en otra moneda', () => {
    const cobro = { monto: 120000, moneda: 'ARS', monedaDeuda: 'USD', montoDeuda: 100 };
    expect(registrarCobroSchema.safeParse(cobro).success).toBe(true);
  });

  it('exige la moneda y el monto de la deuda juntos', () => {
    expect(registrarCobroSchema.safeParse({ monto: 1, moneda: 'ARS', monedaDeuda: 'USD' }).success).toBe(
      false
    );
    expect(registrarCobroSchema.safeParse({ monto: 1, moneda: 'ARS', montoDeuda: 1 }).success).toBe(false);
  });

  it('rechaza una conversión a la misma moneda', () => {
    const cobro = { monto: 100, moneda: 'USD', monedaDeuda: 'USD', montoDeuda: 100 };
    expect(registrarCobroSchema.safeParse(cobro).success).toBe(false);
  });
});
