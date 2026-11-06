import { describe, expect, it } from 'vitest';
import {
  describirEquipoStock,
  esImeiValido,
  formularioAInput,
  formularioVacio,
  imeiLeido,
  otroIgual,
  textoAlmacenamiento,
  validarFormulario,
  type EquipoStockForm
} from './stock-form';

const iphone: EquipoStockForm = {
  ...formularioVacio('05/11/2026'),
  marca: 'Apple',
  modelo: 'iPhone 13',
  almacenamiento: '128',
  bateria: '86',
  imei: '4901 5420 3237 518',
  costo: '900',
  precio: '1150'
};

describe('formulario de stock', () => {
  it('arma lo que espera la API', () => {
    expect(validarFormulario(iphone)).toBeNull();
    expect(formularioAInput(iphone)).toMatchObject({
      almacenamientoGb: 128,
      bateria: 86,
      imei: '490154203237518',
      fechaCompra: '2026-11-05',
      costo: 900,
      cotizacionCosto: null,
      monedaPrecio: 'USD',
      precio: 1150
    });
  });

  it('1 TB se guarda como 1024 GB', () => {
    expect(formularioAInput({ ...iphone, almacenamiento: '1', unidad: 'TB' }).almacenamientoGb).toBe(1024);
    expect(textoAlmacenamiento(1024)).toBe('1 TB');
    expect(textoAlmacenamiento(256)).toBe('256 GB');
  });

  it('pide la cotización si el costo es en pesos', () => {
    expect(validarFormulario({ ...iphone, monedaCosto: 'ARS', costo: '520000' })).toMatch(/dólar/);
    expect(
      validarFormulario({ ...iphone, monedaCosto: 'ARS', costo: '520000', cotizacionCosto: '1150' })
    ).toBeNull();
  });

  it('avisa un IMEI mal leído', () => {
    expect(validarFormulario({ ...iphone, imei: '490154203237519' })).toMatch(/IMEI/);
    expect(esImeiValido('490154203237518')).toBe(true);
  });

  it('un nuevo no manda batería', () => {
    expect(formularioAInput({ ...iphone, condicion: 'nuevo' }).bateria).toBeNull();
  });

  it('"otro igual" vacía lo propio de cada unidad', () => {
    const siguiente = otroIgual({ ...iphone, numeroSerie: 'F2LX' });
    expect(siguiente).toMatchObject({
      modelo: 'iPhone 13',
      costo: '900',
      imei: '',
      numeroSerie: '',
      bateria: ''
    });
  });

  it('describe el equipo en una línea', () => {
    expect(
      describirEquipoStock({ marca: 'Apple', modelo: 'iPhone 13', almacenamientoGb: 128, color: 'Azul' })
    ).toBe('Apple iPhone 13 · 128 GB · Azul');
  });
});

describe('imeiLeido', () => {
  it('toma el IMEI de un código de barras o de un QR con más datos', () => {
    expect(imeiLeido('490154203237518')).toBe('490154203237518');
    expect(imeiLeido('IMEI1:356789101234563 IMEI2:490154203237518')).toBe('356789101234563');
    expect(imeiLeido('IMEI1:356789101234563 IMEI2:490154203237518', '356789101234563')).toBe(
      '490154203237518'
    );
  });

  it('un serial o un IMEI con el control mal no sirven', () => {
    expect(imeiLeido('F2LXK9QWN1')).toBeNull();
    expect(imeiLeido('490154203237519')).toBeNull();
  });
});

it('quien no es admin edita sin ver el costo', () => {
  expect(validarFormulario({ ...iphone, costo: '' }, false)).toBeNull();
  expect(validarFormulario({ ...iphone, costo: '' })).toContain('valor de compra');
});
