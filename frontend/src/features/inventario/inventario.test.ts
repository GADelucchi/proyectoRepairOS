import { describe, expect, it } from 'vitest';
import type { MovimientoInventario } from '@/shared/types';
import { cantidadConSigno, lineasDePrecios, textoCostos, textoMovimiento } from './inventario';

const sinEspacioDuro = (texto: string) => texto.replace(/\s/g, ' ');

const movimiento = (datos: Partial<MovimientoInventario>): MovimientoInventario => ({
  id: 1,
  tipo: 'entrada',
  cantidad: 1,
  fecha: '2026-11-18T12:00:00Z',
  nota: null,
  usuario: null,
  entrada: null,
  orden: null,
  venta: null,
  pase: null,
  equipoStock: null,
  ...datos
});

describe('textos del inventario', () => {
  it('agrupa lo que queda por costo', () => {
    expect(
      sinEspacioDuro(
        textoCostos([
          { moneda: 'USD', costo: 100, costoUsd: 100, cantidad: 5 },
          { moneda: 'USD', costo: 120, costoUsd: 120, cantidad: 5 }
        ])
      )
    ).toBe('5 × US$ 100 · 5 × US$ 120');
  });

  it('solo muestra los precios con monto', () => {
    expect(
      lineasDePrecios({
        precios: [
          { posicion: 1, nombre: 'Lista', monto: 190, moneda: 'USD' },
          { posicion: 2, nombre: 'Efectivo', monto: null, moneda: null }
        ]
      }).map(sinEspacioDuro)
    ).toEqual(['Lista US$ 190']);
  });

  it('describe cada movimiento con lo que lo originó', () => {
    expect(textoMovimiento(movimiento({ tipo: 'orden', orden: { id: 3, numero: 'ORD-0287' } }))).toBe(
      'Usado en la orden ORD-0287'
    );
    expect(textoMovimiento(movimiento({ tipo: 'venta', venta: { id: 2, etiqueta: 'VTA-000021' } }))).toBe(
      'Vendido en VTA-000021'
    );
    expect(textoMovimiento(movimiento({ tipo: 'pase_salida', pase: { id: 1, etiqueta: 'P-0005' } }))).toBe(
      'Pase a otra sucursal P-0005'
    );
    expect(textoMovimiento(movimiento({ tipo: 'entrada' }))).toBe('Entrada');
  });

  it('pone el signo a la cantidad', () => {
    expect(cantidadConSigno(5)).toBe('+5');
    expect(cantidadConSigno(-2)).toBe('−2');
    expect(cantidadConSigno(0)).toBe('0');
  });
});
