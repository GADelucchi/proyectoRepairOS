import { describe, expect, it } from 'vitest';
import { htmlDeEtiquetaStock, idDeStockEnQr } from './etiqueta';

const usado = {
  numero: 42,
  marca: 'Apple',
  modelo: 'iPhone 13',
  almacenamientoGb: 128,
  color: 'Azul',
  condicion: 'usado' as const,
  bateria: 86,
  numeroSerie: 'F17GX8PQ2L',
  precio: '520.00',
  monedaPrecio: 'USD' as const
};

describe('idDeStockEnQr', () => {
  it('lee el id del link de la etiqueta, desde cualquier dominio', () => {
    expect(idDeStockEnQr('https://app.repairos.ar/stock/42')).toBe(42);
    expect(idDeStockEnQr(' http://localhost:5173/stock/7/ ')).toBe(7);
  });

  it('no confunde otras etiquetas ni pantallas con un equipo del stock', () => {
    expect(idDeStockEnQr('https://app.repairos.ar/equipos/42')).toBeNull();
    expect(idDeStockEnQr('https://app.repairos.ar/stock/nuevo')).toBeNull();
    expect(idDeStockEnQr('F17GX8PQ2L')).toBeNull();
  });
});

describe('htmlDeEtiquetaStock', () => {
  it('lleva la franja con el número, el equipo, la batería y el serial', () => {
    const html = htmlDeEtiquetaStock(usado, 'data:qr');
    expect(html).toContain('<span>STOCK</span><span>#0042</span>');
    expect(html).toContain('Apple iPhone 13');
    expect(html).toContain('128 GB · Azul');
    expect(html).toContain('Usado · Batería 86%');
    expect(html).toContain('S/N F17GX8PQ2L');
    expect(html).toContain('size: 50mm 30mm');
  });

  it('el precio va solo si se pide', () => {
    expect(htmlDeEtiquetaStock(usado, 'data:qr')).not.toContain('class="precio"');
    expect(htmlDeEtiquetaStock(usado, 'data:qr', { conPrecio: true })).toMatch(/class="precio">US\$\s520</);
  });

  it('sin serial no deja la línea vacía, y escapa lo que se tipeó', () => {
    const html = htmlDeEtiquetaStock(
      { ...usado, numeroSerie: null, condicion: 'nuevo', modelo: 'Galaxy <A55>' },
      'data:qr'
    );
    expect(html).not.toContain('S/N');
    expect(html).toContain('Galaxy &lt;A55&gt;');
    expect(html).toContain('<div>Nuevo</div>');
  });
});
