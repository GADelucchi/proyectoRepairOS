import { describe, expect, it } from 'vitest';
import { ESTADOS_ORDEN } from '../../models/Orden';
import { esEstadoFinal, esTransicionValida, TRANSICIONES_ORDEN } from './estado-orden';

describe('máquina de estados de la orden', () => {
  it('define transiciones para todos los estados', () => {
    expect(Object.keys(TRANSICIONES_ORDEN).sort()).toEqual([...ESTADOS_ORDEN].sort());
  });

  it('solo se entrega desde "listo para retirar", reparado o no', () => {
    const origenes = ESTADOS_ORDEN.filter((e) => esTransicionValida(e, 'entregado'));
    expect(origenes).toEqual(['listo_para_retirar', 'no_reparado']);
  });

  it('desde "recibido" se pasa a cualquier estado menos entregado', () => {
    const destinos = ESTADOS_ORDEN.filter((e) => e !== 'recibido' && e !== 'entregado');
    expect([...TRANSICIONES_ORDEN.recibido].sort()).toEqual(destinos.sort());
  });

  it('desde "aprobado" se pasa a reparado o no reparado', () => {
    expect(esTransicionValida('aprobado', 'listo_para_retirar')).toBe(true);
    expect(esTransicionValida('aprobado', 'no_reparado')).toBe(true);
  });

  it('entregado y cancelado son finales', () => {
    expect(esEstadoFinal('entregado')).toBe(true);
    expect(esEstadoFinal('cancelado')).toBe(true);
    expect(esEstadoFinal('recibido')).toBe(false);
  });

  it('no permite aprobar algo que no se presupuestó (salvo desde la recepción)', () => {
    expect(esTransicionValida('en_diagnostico', 'aprobado')).toBe(false);
    expect(esTransicionValida('presupuestado', 'aprobado')).toBe(true);
  });
});
