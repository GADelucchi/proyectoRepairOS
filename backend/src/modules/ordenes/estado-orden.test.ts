import { describe, expect, it } from 'vitest';
import { ESTADOS_ORDEN } from '../../models/Orden';
import { esEstadoFinal, esTransicionValida, TRANSICIONES_ORDEN } from './estado-orden';

describe('máquina de estados de la orden', () => {
  it('define transiciones para todos los estados', () => {
    expect(Object.keys(TRANSICIONES_ORDEN).sort()).toEqual([...ESTADOS_ORDEN].sort());
  });

  it('solo se entrega desde "listo para retirar"', () => {
    const origenes = ESTADOS_ORDEN.filter((e) => esTransicionValida(e, 'entregado'));
    expect(origenes).toEqual(['listo_para_retirar']);
  });

  it('entregado y cancelado son finales', () => {
    expect(esEstadoFinal('entregado')).toBe(true);
    expect(esEstadoFinal('cancelado')).toBe(true);
    expect(esEstadoFinal('recibido')).toBe(false);
  });

  it('no permite aprobar algo que no se presupuestó', () => {
    expect(esTransicionValida('recibido', 'aprobado')).toBe(false);
    expect(esTransicionValida('presupuestado', 'aprobado')).toBe(true);
  });
});
