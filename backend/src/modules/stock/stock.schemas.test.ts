import { describe, expect, it } from 'vitest';
import { equipoStockSchema } from './stock.schemas';

const base = {
  marca: 'Apple',
  modelo: 'iPhone 13',
  almacenamientoGb: 128,
  condicion: 'usado',
  bateria: 86,
  imei: '4901 5420 3237 518',
  fechaCompra: '2026-11-05',
  monedaCosto: 'USD',
  costo: 900
};

describe('equipoStockSchema', () => {
  it('acepta un equipo en dólares sin cotización y guarda el IMEI solo con dígitos', () => {
    const r = equipoStockSchema.parse(base);
    expect(r.imei).toBe('490154203237518');
    expect(r.cotizacionCosto).toBeNull();
  });

  it('pide la cotización si el costo no es en dólares', () => {
    expect(equipoStockSchema.safeParse({ ...base, monedaCosto: 'ARS', costo: 520000 }).success).toBe(false);
    expect(
      equipoStockSchema.safeParse({ ...base, monedaCosto: 'ARS', costo: 520000, cotizacionCosto: 1150 })
        .success
    ).toBe(true);
  });

  it('rechaza un IMEI con el dígito de control mal', () => {
    expect(equipoStockSchema.safeParse({ ...base, imei: '490154203237519' }).success).toBe(false);
  });

  it('exige el serial o el IMEI', () => {
    expect(equipoStockSchema.safeParse({ ...base, imei: null }).success).toBe(false);
    expect(equipoStockSchema.safeParse({ ...base, imei: null, numeroSerie: 'F2LXK9QWN1' }).success).toBe(
      true
    );
  });

  it('un equipo nuevo no guarda batería', () => {
    expect(equipoStockSchema.parse({ ...base, condicion: 'nuevo' }).bateria).toBeNull();
  });

  it('el precio de lista toma la moneda del costo si no se indica', () => {
    expect(equipoStockSchema.parse({ ...base, precio: 1150 }).monedaPrecio).toBe('USD');
    expect(equipoStockSchema.parse(base).monedaPrecio).toBeNull();
  });
});
