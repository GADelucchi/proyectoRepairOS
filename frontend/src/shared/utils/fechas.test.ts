import { describe, expect, it } from 'vitest';
import {
  convertirAFormatoBackend,
  convertirDesdeBackend,
  fechaLocalISO,
  formatearFecha,
  validarFechaDDMMYYYY
} from './fechas';

describe('fechas de calendario', () => {
  it('convierte DD/MM/AAAA a ISO y vuelta sin correrse un día', () => {
    expect(convertirAFormatoBackend('05/03/2026')).toBe('2026-03-05');
    expect(convertirDesdeBackend('2026-03-05')).toBe('05/03/2026');
    expect(formatearFecha('2026-03-05')).toBe('05/03/2026');
  });

  it('rechaza fechas que no existen', () => {
    expect(convertirAFormatoBackend('31/02/2026')).toBeNull();
    expect(validarFechaDDMMYYYY('31/02/2026')).toMatch(/no existe/);
    expect(validarFechaDDMMYYYY('5/3/26')).toMatch(/Formato/);
    expect(validarFechaDDMMYYYY('')).toBeNull();
  });

  it('la fecha local usa el día del navegador, no el de UTC', () => {
    expect(fechaLocalISO(new Date(2026, 9, 2, 23, 30))).toBe('2026-10-02');
  });
});
