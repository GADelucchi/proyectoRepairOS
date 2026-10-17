import { describe, expect, it } from 'vitest';
import { clasificarOrden, contarOrdenes, FilaOrdenCliente } from './resumen';

const fila = (
  estado: string,
  resultado: string | null,
  presupuestoAprobado: FilaOrdenCliente['presupuestoAprobado'] = 1
) => ({
  estado,
  resultado,
  presupuestoAprobado
});

describe('resumen de órdenes del cliente', () => {
  it('cuenta reparadas, no reparadas, entregadas, canceladas y en curso', () => {
    expect(
      contarOrdenes([
        fila('entregado', 'listo_para_retirar'),
        fila('entregado', 'no_reparado'),
        fila('listo_para_retirar', 'listo_para_retirar'),
        fila('cancelado', null),
        fila('recibido', null)
      ])
    ).toEqual({ total: 5, enCurso: 2, reparadas: 2, noReparadas: 1, entregadas: 2, canceladas: 1 });
  });

  it('un rechazo de antes de "No reparado" cuenta como no reparada', () => {
    expect(contarOrdenes([fila('entregado', 'listo_para_retirar', 0)])).toMatchObject({
      reparadas: 0,
      noReparadas: 1
    });
  });

  it('una orden que volvió a "aprobado" todavía no tiene resultado', () => {
    expect(contarOrdenes([fila('aprobado', 'listo_para_retirar')])).toMatchObject({
      enCurso: 1,
      reparadas: 0,
      noReparadas: 0
    });
  });

  it('clasifica cada orden con las mismas claves que el conteo', () => {
    expect(clasificarOrden(fila('entregado', 'no_reparado'))).toEqual({
      grupo: 'entregadas',
      resultado: 'noReparadas'
    });
    expect(clasificarOrden(fila('recibido', null))).toEqual({ grupo: 'enCurso', resultado: null });
  });
});
