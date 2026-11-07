import { describe, expect, it } from 'vitest';
import type { EquipoStock } from '@/shared/types';
import {
  PAGO_VACIO,
  PARTE_VACIA,
  conPreciosDeLista,
  formularioAVentaInput,
  precioEnMoneda,
  totalesDelFormulario,
  validarVenta,
  ventaVacia,
  type VentaForm
} from './venta-form';

const equipo = { id: 7, precio: '1150.00', monedaPrecio: 'USD' } as EquipoStock;
const HOY = '2026-11-06';

const efectivo = (monto: string) => ({ ...PAGO_VACIO, monto });

const venta = (datos: Partial<VentaForm> = {}): VentaForm => ({
  ...ventaVacia('USD'),
  items: [{ equipo, precio: '1150', editado: false }],
  ...datos
});

describe('precioEnMoneda', () => {
  it('pasa el precio de lista en dólares a la moneda de la venta', () => {
    expect(precioEnMoneda(equipo, 'USD', 0)).toBe(1150);
    expect(precioEnMoneda(equipo, 'ARS', 1200)).toBe(1380000);
    expect(precioEnMoneda(equipo, 'ARS', 0)).toBeNull();
  });

  it('al cambiar la moneda, el precio que tocó el vendedor no se pisa', () => {
    const f = conPreciosDeLista({
      ...venta({ moneda: 'ARS', cotizacion: '1200' }),
      items: [
        { equipo, precio: '1150', editado: false },
        { equipo: { ...equipo, id: 8 }, precio: '1000000', editado: true }
      ]
    });
    expect(f.items.map((i) => i.precio)).toEqual(['1380000', '1000000']);
  });
});

describe('totales y pagos', () => {
  it('la parte de pago baja lo que se paga; el único pago vacío es todo lo que falta', () => {
    const f = venta({
      descuentoTipo: 'monto',
      descuentoValor: '50',
      partes: [{ ...PARTE_VACIA, monto: '300' }]
    });
    expect(totalesDelFormulario(f)).toMatchObject({ total: 1100, partePago: 300, aPagar: 800 });
    expect(validarVenta({ ...f, partes: [] }, HOY)).toBeNull();
    expect(formularioAVentaInput(f).pagos).toEqual([
      { monto: 800, medioPago: 'efectivo', moneda: 'USD', cotizacion: null }
    ]);
  });

  it('vender exige pagar todo y señar, una parte', () => {
    expect(validarVenta(venta({ pagos: [efectivo('500')] }), HOY)).toContain('Señar');
    expect(validarVenta(venta({ modo: 'sena', pagos: [efectivo('')] }), HOY)).toContain('seña');
    expect(validarVenta(venta({ modo: 'sena', pagos: [efectivo('200')] }), HOY)).toBeNull();
  });

  it('US$ 900 en dólares y el resto en pesos: el pago vacío en pesos es lo que falta', () => {
    const pesos = { ...PAGO_VACIO, moneda: 'ARS' as const, cotizacion: '1200' };
    const f = venta({ items: [{ equipo, precio: '1000', editado: true }], pagos: [efectivo('900'), pesos] });
    expect(validarVenta(f, HOY)).toBeNull();
    expect(formularioAVentaInput(f).pagos).toEqual([
      { monto: 900, medioPago: 'efectivo', moneda: 'USD', cotizacion: null },
      { monto: 120000, medioPago: 'efectivo', moneda: 'ARS', cotizacion: 1200 }
    ]);
    // Sin cotización no se puede saber cuánto cubren los pesos.
    expect(validarVenta({ ...f, pagos: [efectivo('900'), { ...pesos, cotizacion: '' }] }, HOY)).toContain(
      'cotización'
    );
    // Con el monto escrito, tiene que cubrir lo que falta.
    expect(validarVenta({ ...f, pagos: [efectivo('900'), { ...pesos, monto: '60000' }] }, HOY)).toContain(
      'Señar'
    );
  });

  it('en pesos pide la cotización, y una reserva pide la fecha', () => {
    expect(validarVenta(venta({ moneda: 'ARS' }), HOY)).toContain('dólar');
    expect(validarVenta(venta({ modo: 'reserva' }), HOY)).toContain('hasta qué día');
    expect(validarVenta(venta({ modo: 'reserva', reservadaHasta: '05/11/2026' }), HOY)).toContain(
      'posterior'
    );
    const reserva = venta({ modo: 'reserva', reservadaHasta: '10/11/2026' });
    expect(validarVenta(reserva, HOY)).toBeNull();
    expect(formularioAVentaInput(reserva)).toMatchObject({ pagos: [], reservadaHasta: '2026-11-10' });
  });
});
