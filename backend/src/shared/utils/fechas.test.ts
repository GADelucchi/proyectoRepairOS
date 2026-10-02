import { describe, expect, it } from 'vitest';
import { esFechaIsoValida, fechaEnZona, formatearFechaHora, inicioDelDia, sumarDias } from './fechas';

const BA = 'America/Argentina/Buenos_Aires';

describe('fechas en la zona del negocio', () => {
  it('a las 22 hs de Buenos Aires sigue siendo el mismo día, aunque en UTC ya sea mañana', () => {
    const instante = new Date('2026-10-03T01:00:00Z'); // 22:00 del 2 de octubre en BA
    expect(fechaEnZona(instante, BA)).toBe('2026-10-02');
  });

  it('el día en Buenos Aires empieza a las 03:00 UTC', () => {
    expect(inicioDelDia('2026-10-02', BA).toISOString()).toBe('2026-10-02T03:00:00.000Z');
  });

  it('formatea la hora local, no la del servidor', () => {
    expect(formatearFechaHora(new Date('2026-10-02T15:30:00Z'), BA)).toBe('02/10/2026 12:30');
  });

  it('suma días cruzando meses', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('valida fechas de calendario reales', () => {
    expect(esFechaIsoValida('2026-02-28')).toBe(true);
    expect(esFechaIsoValida('2026-02-31')).toBe(false);
    expect(esFechaIsoValida('02/10/2026')).toBe(false);
  });
});
