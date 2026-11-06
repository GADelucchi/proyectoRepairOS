import { describe, expect, it } from 'vitest';
import { type DatosAviso, mensajeParaCliente } from './aviso-cliente';

const presupuestada: DatosAviso = {
  numeroOrden: 'ORD-000001',
  estado: 'presupuestado',
  presupuestoMonto: 50000,
  moneda: 'ARS',
  marca: 'Apple',
  modelo: 'iPhone 13'
};

describe('mensajeParaCliente', () => {
  it('pone el detalle del presupuesto entre el monto y la pregunta', () => {
    const mensaje = mensajeParaCliente(
      { ...presupuestada, presupuestoDetalle: 'Cambio de pantalla' },
      'Taller'
    );
    expect(mensaje).toMatch(/\.\n\nCambio de pantalla\n\n¿Lo aprobás\?/);
  });

  it('sin detalle deja el mensaje en un solo párrafo', () => {
    expect(mensajeParaCliente(presupuestada, 'Taller')).toMatch(/\. ¿Lo aprobás\?/);
  });
});
