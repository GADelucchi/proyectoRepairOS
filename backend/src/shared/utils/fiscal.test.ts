import { describe, expect, it } from 'vitest';
import { esCuitValido } from './fiscal';

describe('esCuitValido', () => {
  it('acepta un CUIT con el verificador correcto', () => {
    expect(esCuitValido('20123456786')).toBe(true);
    expect(esCuitValido('30710445628')).toBe(true);
  });

  it('rechaza un verificador equivocado', () => {
    expect(esCuitValido('20123456787')).toBe(false);
  });

  it('rechaza lo que no son once dígitos', () => {
    expect(esCuitValido('2012345678')).toBe(false);
    expect(esCuitValido('20-12345678-6')).toBe(false);
    expect(esCuitValido('')).toBe(false);
  });
});
