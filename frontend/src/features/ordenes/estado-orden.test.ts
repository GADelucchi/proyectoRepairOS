import { describe, expect, it } from 'vitest';
import {
  CLASE_BADGE_ESTADO,
  ESTADOS_ORDEN,
  TRANSICIONES_ORDEN,
  esEstadoFinal,
  etiquetaEstado,
  transicionesDesde
} from './estado-orden';

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

  it('desde "aprobado" se pasa a reparado o no reparado', () => {
    expect(transicionesDesde('aprobado')).toEqual(
      expect.arrayContaining(['listo_para_retirar', 'no_reparado'])
    );
  });

  it('"en reparación" y "en espera" tienen etiqueta', () => {
    expect(etiquetaEstado('en_reparacion')).toBe('En reparación');
    expect(etiquetaEstado('en_espera')).toBe('En espera');
  });

  it('"externo" y "por recibir" tienen etiqueta y la misma regla que el backend', () => {
    expect(etiquetaEstado('externo')).toBe('Externo');
    expect(etiquetaEstado('por_recibir')).toBe('Por recibir');
    expect(transicionesDesde('por_recibir')).toEqual(['recibido', 'cancelado']);
    expect(transicionesDesde('externo')).not.toContain('entregado');
  });
});
