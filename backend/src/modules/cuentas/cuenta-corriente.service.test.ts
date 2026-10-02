import { describe, expect, it } from 'vitest';
import { creditoDisponible, repartirEntrega } from './cuenta-corriente.service';

describe('creditoDisponible', () => {
  it('es el saldo negativo en positivo', () => {
    expect(creditoDisponible(-1500)).toBe(1500);
  });

  it('es cero si el cliente debe o está al día', () => {
    expect(creditoDisponible(200)).toBe(0);
    expect(creditoDisponible(0)).toBe(0);
  });
});

describe('repartirEntrega', () => {
  it('no deja deuda si paga todo', () => {
    expect(repartirEntrega(0, 10000, 10000)).toEqual({ creditoAplicado: 0, pendiente: 0 });
  });

  it('deja en cuenta lo que no paga', () => {
    expect(repartirEntrega(0, 10000, 4000)).toEqual({ creditoAplicado: 0, pendiente: 6000 });
  });

  it('usa el saldo a favor antes de generar deuda', () => {
    expect(repartirEntrega(-2500, 10000, 4000)).toEqual({ creditoAplicado: 2500, pendiente: 3500 });
  });

  it('no usa más crédito del necesario', () => {
    expect(repartirEntrega(-50000, 10000, 4000)).toEqual({ creditoAplicado: 6000, pendiente: 0 });
  });

  it('una deuda previa no bloquea a quien paga la orden completa', () => {
    expect(repartirEntrega(8000, 10000, 10000)).toEqual({ creditoAplicado: 0, pendiente: 0 });
  });

  it('redondea a centavos', () => {
    expect(repartirEntrega(0, 0.3, 0.1).pendiente).toBe(0.2);
  });
});
