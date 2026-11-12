import { describe, expect, it } from 'vitest';
import { ESTADOS_ORDEN } from '../../models/Orden';
import {
  esEstadoFinal,
  esTransicionValida,
  estadoParaCliente,
  historialParaCliente,
  TRANSICIONES_ORDEN
} from './estado-orden';

describe('máquina de estados de la orden', () => {
  it('define transiciones para todos los estados', () => {
    expect(Object.keys(TRANSICIONES_ORDEN).sort()).toEqual([...ESTADOS_ORDEN].sort());
  });

  it('solo se entrega desde "listo para retirar", reparado o no', () => {
    const origenes = ESTADOS_ORDEN.filter((e) => esTransicionValida(e, 'entregado'));
    expect(origenes).toEqual(['listo_para_retirar', 'no_reparado']);
  });

  it('desde "recibido" se pasa a cualquier estado menos entregado (y "por recibir", que es anterior)', () => {
    const destinos = ESTADOS_ORDEN.filter((e) => !['recibido', 'entregado', 'por_recibir'].includes(e));
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

  it('a "por recibir" no se vuelve: solo se sale, recibiendo el equipo o rechazándolo', () => {
    expect(ESTADOS_ORDEN.filter((e) => esTransicionValida(e, 'por_recibir'))).toEqual([]);
    expect(TRANSICIONES_ORDEN.por_recibir).toEqual(['recibido', 'cancelado']);
  });

  it('del externo vuelve a reparación, listo o sin arreglo, pero no se entrega directo', () => {
    expect(esTransicionValida('externo', 'en_reparacion')).toBe(true);
    expect(esTransicionValida('externo', 'listo_para_retirar')).toBe(true);
    expect(esTransicionValida('externo', 'entregado')).toBe(false);
  });
});

describe('lo que ve el cliente', () => {
  it('un equipo en un taller externo sigue "en reparación"', () => {
    expect(estadoParaCliente('externo')).toBe('en_reparacion');
    expect(estadoParaCliente('presupuestado')).toBe('presupuestado');
  });

  it('el historial no muestra la ida y vuelta al externo', () => {
    const historial = historialParaCliente([
      { estadoAnterior: null, estadoNuevo: 'recibido', comentario: 'Orden creada' },
      { estadoAnterior: 'recibido', estadoNuevo: 'en_reparacion', comentario: null },
      { estadoAnterior: 'en_reparacion', estadoNuevo: 'externo', comentario: null },
      { estadoAnterior: 'externo', estadoNuevo: 'listo_para_retirar', comentario: null }
    ]);
    expect(historial.map((h) => h.estadoNuevo)).toEqual(['recibido', 'en_reparacion', 'listo_para_retirar']);
    expect(historial[2].estadoAnterior).toBe('en_reparacion');
    expect(JSON.stringify(historial)).not.toContain('externo');
  });

  it('un renglón con comentario para el cliente queda aunque no cambie el estado visible', () => {
    const historial = historialParaCliente([
      { estadoAnterior: 'en_reparacion', estadoNuevo: 'externo', comentario: 'Esperamos el repuesto' }
    ]);
    expect(historial).toHaveLength(1);
    expect(historial[0].estadoNuevo).toBe('en_reparacion');
  });
});
