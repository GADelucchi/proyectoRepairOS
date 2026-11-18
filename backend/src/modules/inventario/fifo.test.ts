import { describe, expect, it } from 'vitest';
import { repartirPorAntiguedad } from './fifo';

const entradas = [
  { id: 41, disponible: 5 },
  { id: 58, disponible: 5 }
];

describe('repartirPorAntiguedad', () => {
  it('toma primero de la entrada más vieja', () => {
    expect(repartirPorAntiguedad(entradas, 3)).toEqual([{ entradaId: 41, cantidad: 3 }]);
  });

  it('si no alcanza con una, sigue con la siguiente', () => {
    expect(repartirPorAntiguedad(entradas, 7)).toEqual([
      { entradaId: 41, cantidad: 5 },
      { entradaId: 58, cantidad: 2 }
    ]);
  });

  it('saltea las entradas agotadas', () => {
    expect(repartirPorAntiguedad([{ id: 1, disponible: 0 }, ...entradas], 1)).toEqual([
      { entradaId: 41, cantidad: 1 }
    ]);
  });

  it('con una entrada elegida, empieza por esa', () => {
    expect(repartirPorAntiguedad(entradas, 6, 58)).toEqual([
      { entradaId: 58, cantidad: 5 },
      { entradaId: 41, cantidad: 1 }
    ]);
  });

  it('si no hay suficiente, devuelve null', () => {
    expect(repartirPorAntiguedad(entradas, 11)).toBeNull();
    expect(repartirPorAntiguedad([], 1)).toBeNull();
  });
});
