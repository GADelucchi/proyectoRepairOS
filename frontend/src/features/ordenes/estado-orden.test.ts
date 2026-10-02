import { describe, expect, it } from 'vitest';
import { CLASE_BADGE_ESTADO, ESTADOS_ORDEN, TRANSICIONES_ORDEN, esEstadoFinal } from './estado-orden';

describe('estado de la orden (frontend)', () => {
  it('cada estado tiene transiciones y color', () => {
    for (const estado of ESTADOS_ORDEN) {
      expect(TRANSICIONES_ORDEN[estado]).toBeDefined();
      expect(CLASE_BADGE_ESTADO[estado]).toBeDefined();
    }
  });

  it('entregado y cancelado son finales', () => {
    expect(esEstadoFinal('entregado')).toBe(true);
    expect(esEstadoFinal('cancelado')).toBe(true);
  });
});
