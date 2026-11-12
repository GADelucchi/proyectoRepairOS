import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';
import { patronDeCuit } from './tercerizacion.service';

describe('patronDeCuit', () => {
  it('un CUIT se busca entero, con o sin guiones', () => {
    expect(patronDeCuit('30-71234567-1')).toBe('30712345671');
  });

  it('un DNI se busca en el medio del CUIT, con 8 dígitos', () => {
    expect(patronDeCuit('25.123.456')).toEqual({ [Op.like]: '__25123456_' });
    expect(patronDeCuit('5123456')).toEqual({ [Op.like]: '__05123456_' });
  });

  it('cualquier otro largo no busca nada', () => {
    expect(patronDeCuit('1234')).toBeNull();
    expect(patronDeCuit('123456789')).toBeNull();
  });
});
