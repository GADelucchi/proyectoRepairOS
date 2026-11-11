import { describe, expect, it } from 'vitest';
import { equipoPublico, memoriaLegible } from './catalogo.service';

const usado = {
  numero: 42,
  marca: 'Apple',
  modelo: 'iPhone 13',
  color: 'Azul',
  almacenamientoGb: 128,
  condicion: 'usado' as const,
  bateria: 87,
  monedaPrecio: 'USD' as const,
  precio: '650.00',
  sucursal: { nombre: 'Centro' },
  // Lo interno que nunca tiene que salir.
  costo: '400.00',
  proveedor: 'Mayorista',
  imei: '356938035643809',
  numeroSerie: 'F2LXK0ABCD',
  observaciones: 'Pantalla cambiada'
};

describe('equipoPublico', () => {
  it('devuelve lo que ve el cliente', () => {
    expect(equipoPublico(usado as never)).toEqual({
      codigo: '#0042',
      marca: 'Apple',
      modelo: 'iPhone 13',
      color: 'Azul',
      memoria: '128 GB',
      almacenamientoGb: 128,
      condicion: 'usado',
      bateria: 87,
      precio: 650,
      moneda: 'USD',
      sucursal: 'Centro'
    });
  });

  it('nunca expone costo, proveedor, IMEI, serie ni observaciones', () => {
    const json = JSON.stringify(equipoPublico(usado as never));
    for (const secreto of ['400', 'Mayorista', '356938035643809', 'F2LXK0ABCD', 'Pantalla']) {
      expect(json).not.toContain(secreto);
    }
  });

  it('en un equipo nuevo no muestra batería', () => {
    expect(equipoPublico({ ...usado, condicion: 'nuevo', bateria: 100 } as never).bateria).toBeNull();
  });
});

describe('memoriaLegible', () => {
  it('pasa a TB los múltiplos de 1024', () => {
    expect(memoriaLegible(1024)).toBe('1 TB');
    expect(memoriaLegible(256)).toBe('256 GB');
    expect(memoriaLegible(null)).toBeNull();
  });
});
