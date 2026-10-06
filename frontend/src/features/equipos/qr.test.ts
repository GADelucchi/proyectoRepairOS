import { describe, expect, it } from 'vitest';
import { idDeEquipoEnQr } from './qr';

describe('idDeEquipoEnQr', () => {
  it('lee el id del link de la etiqueta, de cualquier dominio', () => {
    expect(idDeEquipoEnQr('https://proyectorepairos.onrender.com/equipos/42')).toBe(42);
    expect(idDeEquipoEnQr('http://localhost:5173/equipos/7/')).toBe(7);
  });

  it('descarta lo que no es una etiqueta de equipo', () => {
    expect(idDeEquipoEnQr('https://proyectorepairos.onrender.com/ordenes/42')).toBeNull();
    expect(idDeEquipoEnQr('https://ejemplo.com/equipos/abc')).toBeNull();
    expect(idDeEquipoEnQr('SN-12345')).toBeNull();
  });
});
