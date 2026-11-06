import { describe, expect, it } from 'vitest';
import { esImeiValido, normalizarImei } from './imei';

describe('esImeiValido', () => {
  it('acepta un IMEI con el dígito de control correcto', () => {
    expect(esImeiValido('490154203237518')).toBe(true);
  });

  it('rechaza un dígito mal leído', () => {
    expect(esImeiValido('490154203237519')).toBe(false);
    expect(esImeiValido('490154213237518')).toBe(false);
  });

  it('rechaza lo que no tiene 15 dígitos', () => {
    expect(esImeiValido('49015420323751')).toBe(false);
    expect(esImeiValido('4901542032375180')).toBe(false);
    expect(esImeiValido('49015420323751A')).toBe(false);
  });
});

describe('normalizarImei', () => {
  it('saca espacios, guiones y barras', () => {
    expect(normalizarImei('49-015420 323751/8')).toBe('490154203237518');
  });
});
