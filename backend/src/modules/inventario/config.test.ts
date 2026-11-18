import { describe, expect, it } from 'vitest';
import { codigoGenerado, configDeInventario } from './config';

describe('configDeInventario', () => {
  it('sin nada guardado, usa los valores de fábrica', () => {
    expect(configDeInventario(null)).toMatchObject({
      precios: ['Lista', 'Efectivo', 'Tarjeta'],
      avisoApp: true,
      prefijos: { repuesto: 'R-', accesorio: 'A-', servicio: 'S-' }
    });
  });

  it('respeta los precios que el taller borró o renombró', () => {
    expect(configDeInventario({ precios: ['Lista', null, 'Tarjeta 3 cuotas'] }).precios).toEqual([
      'Lista',
      null,
      'Tarjeta 3 cuotas'
    ]);
    expect(configDeInventario({ precios: ['Contado'] }).precios).toEqual(['Contado', null, null]);
    expect(configDeInventario({ precios: ['  ', 'Efectivo'] }).precios).toEqual([null, 'Efectivo', null]);
  });

  it('completa los prefijos que faltan', () => {
    expect(configDeInventario({ prefijos: { repuesto: 'REP-' } }).prefijos).toEqual({
      repuesto: 'REP-',
      accesorio: 'A-',
      servicio: 'S-'
    });
  });
});

describe('codigoGenerado', () => {
  it('rellena con ceros', () => {
    expect(codigoGenerado('R-', 12)).toBe('R-0012');
    expect(codigoGenerado('A-', 12345)).toBe('A-12345');
  });
});
