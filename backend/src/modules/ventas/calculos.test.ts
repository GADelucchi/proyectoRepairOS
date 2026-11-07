import { describe, expect, it } from 'vitest';
import { equivalenteDe, etiquetaVenta, problemaDePago, problemaDeTotales, totalesDeVenta } from './calculos';

describe('totalesDeVenta', () => {
  it('sin descuento ni parte de pago, se paga lo que suman los equipos', () => {
    expect(totalesDeVenta([1000, 150.5])).toEqual({
      subtotal: 1150.5,
      descuento: 0,
      total: 1150.5,
      partePago: 0,
      aPagar: 1150.5
    });
  });

  it('el descuento por porcentaje se calcula sobre el subtotal', () => {
    expect(totalesDeVenta([999], { tipo: 'porcentaje', valor: 10 })).toMatchObject({
      descuento: 99.9,
      total: 899.1
    });
  });

  it('la parte de pago baja lo que se paga, no lo que vale la venta', () => {
    const t = totalesDeVenta([1200], { tipo: 'monto', valor: 50 }, [300, 100]);
    expect(t).toMatchObject({ total: 1150, partePago: 400, aPagar: 750 });
    expect(problemaDeTotales(t)).toBeNull();
  });

  it('avisa si el descuento o la parte de pago superan la venta', () => {
    expect(problemaDeTotales(totalesDeVenta([100], { tipo: 'monto', valor: 150 }))).toContain('descuento');
    expect(problemaDeTotales(totalesDeVenta([100], null, [120]))).toContain('parte de pago');
  });
});

describe('pagos en otra moneda', () => {
  it('US$ 900 en dólares y el resto en pesos cubren una venta de US$ 1000', () => {
    const pesos = { monto: 120_000, moneda: 'ARS' as const, cotizacion: 1200 };
    expect(problemaDePago(pesos, 'USD')).toBeNull();
    expect(equivalenteDe(pesos, 'USD')).toBe(100);
    expect(equivalenteDe({ monto: 900, moneda: 'USD' }, 'USD')).toBe(900);
  });

  it('dólares en una venta en pesos se multiplican por la cotización', () => {
    expect(equivalenteDe({ monto: 50, moneda: 'USD', cotizacion: 1200 }, 'ARS')).toBe(60_000);
  });

  it('pide la cotización y que uno de los dos sea en dólares', () => {
    expect(problemaDePago({ monto: 1000, moneda: 'ARS' }, 'USD')).toContain('cotización');
    expect(problemaDePago({ monto: 1000, moneda: 'UYU', cotizacion: 40 }, 'ARS')).toContain('dólares');
    expect(problemaDePago({ monto: 1000, moneda: 'ARS' }, 'ARS')).toBeNull();
  });
});

it('etiquetaVenta', () => {
  expect(etiquetaVenta(42)).toBe('VTA-000042');
});
