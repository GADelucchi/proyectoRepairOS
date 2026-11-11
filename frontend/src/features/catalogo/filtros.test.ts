import { describe, expect, it } from 'vitest';
import type { EquipoCatalogo } from './api';
import { FILTROS_INICIALES, filtrarCatalogo, nivelBateria } from './filtros';

const equipo = (datos: Partial<EquipoCatalogo>): EquipoCatalogo => ({
  codigo: '#0001',
  marca: 'Apple',
  modelo: 'iPhone 13',
  color: null,
  memoria: '128 GB',
  almacenamientoGb: 128,
  condicion: 'usado',
  bateria: 86,
  precio: 520,
  moneda: 'USD',
  sucursal: 'Casa Central',
  ...datos
});

const ip13 = equipo({ codigo: '#0004' });
const ip15 = equipo({ codigo: '#0009', modelo: 'iPhone 15', condicion: 'nuevo', bateria: null, precio: 999 });
const s23 = equipo({
  codigo: '#0006',
  marca: 'Samsung',
  modelo: 'Galaxy S23',
  memoria: '256 GB',
  precio: 580
});
const edge = equipo({
  codigo: '#0014',
  marca: 'Motorola',
  modelo: 'Edge 40',
  condicion: 'nuevo',
  precio: 379,
  sucursal: 'Sucursal Norte'
});
const todos = [ip15, s23, ip13, edge];

const codigos = (lista: EquipoCatalogo[]) => lista.map((e) => e.codigo);

describe('filtrarCatalogo', () => {
  it('sin filtros ordena por precio, de menor a mayor', () => {
    expect(codigos(filtrarCatalogo(todos, FILTROS_INICIALES))).toEqual(['#0014', '#0004', '#0006', '#0009']);
  });

  it('busca varias palabras en cualquier orden, sin tildes ni mayúsculas', () => {
    expect(codigos(filtrarCatalogo(todos, { ...FILTROS_INICIALES, texto: '13 IPHONE' }))).toEqual(['#0004']);
    expect(codigos(filtrarCatalogo(todos, { ...FILTROS_INICIALES, texto: 'galaxy 256' }))).toEqual(['#0006']);
  });

  it('filtra por condición, marca y sucursal', () => {
    expect(codigos(filtrarCatalogo(todos, { ...FILTROS_INICIALES, condicion: 'nuevo' }))).toEqual([
      '#0014',
      '#0009'
    ]);
    expect(codigos(filtrarCatalogo(todos, { ...FILTROS_INICIALES, marca: 'Apple' }))).toEqual([
      '#0004',
      '#0009'
    ]);
    expect(codigos(filtrarCatalogo(todos, { ...FILTROS_INICIALES, sucursal: 'Sucursal Norte' }))).toEqual([
      '#0014'
    ]);
  });

  it('ordena por mayor precio o por modelo', () => {
    expect(codigos(filtrarCatalogo(todos, { ...FILTROS_INICIALES, orden: 'precio_desc' }))[0]).toBe('#0009');
    expect(codigos(filtrarCatalogo(todos, { ...FILTROS_INICIALES, orden: 'modelo' }))).toEqual([
      '#0004',
      '#0009',
      '#0014',
      '#0006'
    ]);
  });

  it('no mezcla precios de monedas distintas', () => {
    const enPesos = equipo({ codigo: '#0020', moneda: 'ARS', precio: 300000 });
    expect(codigos(filtrarCatalogo([ip15, enPesos, ip13], FILTROS_INICIALES))).toEqual([
      '#0020',
      '#0004',
      '#0009'
    ]);
  });
});

describe('nivelBateria', () => {
  it('marca en amarillo desde 80% y en rojo debajo', () => {
    expect(nivelBateria(90)).toBe('success');
    expect(nivelBateria(82)).toBe('warning');
    expect(nivelBateria(76)).toBe('danger');
  });
});
