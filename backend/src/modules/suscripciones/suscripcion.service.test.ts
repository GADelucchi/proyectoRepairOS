import { describe, expect, it } from 'vitest';
import { diasEntre, evaluarSuscripcion } from './suscripcion.service';

const prueba = (graciaHasta: string) => ({ estado: 'prueba' as const, graciaHasta, periodoFin: null });

describe('evaluarSuscripcion', () => {
  it('la prueba da acceso hasta el último día inclusive', () => {
    expect(evaluarSuscripcion(prueba('2026-10-10'), '2026-10-06')).toEqual({
      estado: 'prueba',
      hasta: '2026-10-10',
      diasRestantes: 4,
      bloqueada: false
    });
    expect(evaluarSuscripcion(prueba('2026-10-10'), '2026-10-10').bloqueada).toBe(false);
  });

  it('al día siguiente del fin la prueba queda vencida y bloqueada, aunque nadie la haya marcado', () => {
    expect(evaluarSuscripcion(prueba('2026-10-10'), '2026-10-11')).toMatchObject({
      estado: 'vencida',
      bloqueada: true
    });
  });

  it('un plan activo vence en su fin de período; sin fecha no vence', () => {
    const activa = { estado: 'activa' as const, graciaHasta: '2026-01-01' };
    expect(evaluarSuscripcion({ ...activa, periodoFin: '2026-11-01' }, '2026-10-06').bloqueada).toBe(false);
    expect(evaluarSuscripcion({ ...activa, periodoFin: '2026-11-01' }, '2026-11-02').bloqueada).toBe(true);
    expect(evaluarSuscripcion({ ...activa, periodoFin: null }, '2030-01-01')).toEqual({
      estado: 'activa',
      hasta: null,
      diasRestantes: null,
      bloqueada: false
    });
  });

  it('cancelada o vencida bloquean siempre', () => {
    const base = { graciaHasta: '2099-01-01', periodoFin: '2099-01-01' };
    expect(evaluarSuscripcion({ ...base, estado: 'cancelada' }, '2026-10-06').bloqueada).toBe(true);
    expect(evaluarSuscripcion({ ...base, estado: 'vencida' }, '2026-10-06').bloqueada).toBe(true);
  });
});

describe('diasEntre', () => {
  it('cuenta días de calendario y nunca da negativo', () => {
    expect(diasEntre('2026-10-06', '2026-11-06')).toBe(31);
    expect(diasEntre('2026-10-06', '2026-10-01')).toBe(0);
  });
});
