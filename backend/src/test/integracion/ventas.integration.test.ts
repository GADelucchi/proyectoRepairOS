import { describe, expect, it } from 'vitest';
import { Venta, sequelize } from '../../models';
import { api, tallerConSucursal, tecnicoDe, type Sesion } from './helpers';

const IMEI = '490154203237518';
const IMEI_PARTE = '356789101234563';

const cliente = { nombre: 'Lucía', apellido: 'Gómez', dniCuit: '30111222', telefono: '221 555-0000' };

/** Un iPhone en stock: costó US$ 900 y se lista a US$ 1.150. */
async function iphoneEnStock(sesion: Sesion, datos: Record<string, unknown> = {}) {
  const { body } = await api()
    .post('/api/stock')
    .set(sesion.auth)
    .send({
      marca: 'Apple',
      modelo: 'iPhone 13',
      almacenamientoGb: 128,
      condicion: 'usado',
      bateria: 86,
      imei: IMEI,
      fechaCompra: '2026-11-01',
      monedaCosto: 'USD',
      costo: 900,
      precio: 1150,
      ...datos
    })
    .expect(201);
  return body;
}

const hoy = () => new Date().toISOString().slice(0, 10);

async function cajaDeHoy(sesion: Sesion) {
  const { body } = await api().get('/api/reportes/caja').set(sesion.auth).expect(200);
  return body as {
    totales: { moneda: string; cobrado: number }[];
    porOrigen: { clave: string; moneda: string; total: number }[];
  };
}

describe('venta de equipos', () => {
  it('vende en pesos con descuento y parte de pago: el equipo que deja entra al stock', async () => {
    const taller = await tallerConSucursal();
    const equipo = await iphoneEnStock(taller);

    const venta = {
      nuevoCliente: cliente,
      items: [{ equipoStockId: equipo.id, precio: 1380000 }],
      moneda: 'ARS',
      cotizacion: 1200,
      descuento: { tipo: 'porcentaje', valor: 10 },
      partesPago: [
        {
          marca: 'Apple',
          modelo: 'iPhone 11',
          almacenamientoGb: 64,
          bateria: 78,
          imei: IMEI_PARTE,
          monto: 300000
        }
      ],
      modo: 'venta',
      comentarioCliente: 'Incluye funda y vidrio templado.',
      comentarioInterno: 'Pidió factura A la próxima.'
    };

    // Total 1.242.000, menos 300.000 en equipo: tiene que pagar 942.000.
    const corta = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({ ...venta, pagos: [{ monto: 900000, medioPago: 'efectivo' }] })
      .expect(400);
    expect(corta.body.message).toContain('seña');

    const { body } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        ...venta,
        pagos: [
          { monto: 600000, medioPago: 'efectivo' },
          { monto: 342000, medioPago: 'transferencia' }
        ]
      })
      .expect(201);
    expect(body).toMatchObject({
      etiqueta: 'VTA-000001',
      estado: 'completada',
      subtotal: '1380000.00',
      descuento: '138000.00',
      total: '1242000.00',
      partePago: '300000.00',
      pagado: 942000,
      saldo: 0
    });

    // El vendido no se puede volver a vender.
    await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        ...venta,
        partesPago: [],
        descuento: null,
        items: [{ equipoStockId: equipo.id, precio: 1 }],
        pagos: [{ monto: 1, medioPago: 'efectivo' }]
      })
      .expect(409);

    // El iPhone 11 entró como usado, con lo que se le tomó como costo.
    const stock = await api().get('/api/stock').query({ search: IMEI_PARTE }).set(taller.auth).expect(200);
    expect(stock.body.equipos[0]).toMatchObject({
      modelo: 'iPhone 11',
      estado: 'disponible',
      monedaCosto: 'ARS',
      costo: '300000.00',
      costoUsd: 250,
      recibidoEnVentaId: body.id
    });
    const vendido = await api().get(`/api/stock/${equipo.id}`).set(taller.auth).expect(200);
    expect(vendido.body.estado).toBe('vendido');

    const caja = await cajaDeHoy(taller);
    expect(caja.porOrigen).toEqual([
      expect.objectContaining({ clave: 'venta', moneda: 'ARS', total: 942000 })
    ]);
    expect(caja.totales).toEqual([expect.objectContaining({ moneda: 'ARS', cobrado: 942000 })]);

    // Informe en US$: vale 1.035 (1.242.000 / 1.200), costó 900.
    const informe = await api().get('/api/ventas/informe').set(taller.auth).expect(200);
    expect(informe.body.resumen).toMatchObject({
      ventas: 1,
      equipos: 1,
      brutoUsd: 1035,
      costoUsd: 900,
      gananciaUsd: 135,
      partePagoUsd: 250
    });

    const pdf = await api().get(`/api/ventas/${body.id}/pdf`).set(taller.auth).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('una seña aparta el equipo y el pago del saldo completa la venta', async () => {
    const taller = await tallerConSucursal();
    const equipo = await iphoneEnStock(taller);

    const { body: senada } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1150 }],
        moneda: 'USD',
        modo: 'sena',
        pagos: [{ monto: 200, medioPago: 'efectivo' }]
      })
      .expect(201);
    expect(senada).toMatchObject({ estado: 'senada', pagado: 200, saldo: 950 });
    const apartado = await api().get(`/api/stock/${equipo.id}`).set(taller.auth).expect(200);
    expect(apartado.body.estado).toBe('senado');

    await api()
      .post(`/api/ventas/${senada.id}/pagos`)
      .set(taller.auth)
      .send({ pagos: [{ monto: 1000, medioPago: 'efectivo' }] })
      .expect(400);
    const { body: completa } = await api()
      .post(`/api/ventas/${senada.id}/pagos`)
      .set(taller.auth)
      .send({ pagos: [{ monto: 950, medioPago: 'tarjeta_debito' }] })
      .expect(200);
    expect(completa).toMatchObject({ estado: 'completada', saldo: 0 });

    const caja = await cajaDeHoy(taller);
    expect(caja.porOrigen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clave: 'sena', moneda: 'USD', total: 200 }),
        expect.objectContaining({ clave: 'venta', moneda: 'USD', total: 950 })
      ])
    );
  });

  it('se paga en varias monedas: cada una entra a su caja y cubre la venta con su cotización', async () => {
    const taller = await tallerConSucursal();
    const equipo = await iphoneEnStock(taller);
    const venta = {
      nuevoCliente: cliente,
      items: [{ equipoStockId: equipo.id, precio: 1000 }],
      moneda: 'USD',
      modo: 'sena'
    };

    // Los pesos necesitan la cotización.
    const sinCotizacion = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({ ...venta, pagos: [{ monto: 120000, medioPago: 'efectivo', moneda: 'ARS' }] })
      .expect(400);
    expect(sinCotizacion.body.message).toContain('cotización');

    // Seña: US$ 300 en dólares y US$ 100 en pesos a 1.200.
    const { body: senada } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        ...venta,
        pagos: [
          { monto: 300, medioPago: 'efectivo' },
          { monto: 120000, medioPago: 'transferencia', moneda: 'ARS', cotizacion: 1200 }
        ]
      })
      .expect(201);
    expect(senada).toMatchObject({ estado: 'senada', pagado: 400, saldo: 600 });
    expect(senada.pagos[1]).toMatchObject({
      moneda: 'ARS',
      monto: '120000.00',
      cotizacion: '1200.0000',
      equivalente: '100.00'
    });

    // El resto: US$ 500 y US$ 100 en pesos a 1.250.
    const { body: completa } = await api()
      .post(`/api/ventas/${senada.id}/pagos`)
      .set(taller.auth)
      .send({
        pagos: [
          { monto: 500, medioPago: 'efectivo', moneda: 'USD' },
          { monto: 125000, medioPago: 'efectivo', moneda: 'ARS', cotizacion: 1250 }
        ]
      })
      .expect(200);
    expect(completa).toMatchObject({ estado: 'completada', pagado: 1000, saldo: 0 });

    // En la caja cada moneda por su lado: lo que hay en el cajón.
    const caja = await cajaDeHoy(taller);
    expect(caja.totales).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ moneda: 'USD', cobrado: 800 }),
        expect.objectContaining({ moneda: 'ARS', cobrado: 245000 })
      ])
    );
    const pdf = await api().get(`/api/ventas/${senada.id}/pdf`).set(taller.auth).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('al cancelar, la seña se devuelve en las monedas en que entró', async () => {
    const taller = await tallerConSucursal();
    const equipo = await iphoneEnStock(taller);
    const { body: senada } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1000 }],
        moneda: 'USD',
        modo: 'sena',
        pagos: [
          { monto: 100, medioPago: 'efectivo' },
          { monto: 60000, medioPago: 'efectivo', moneda: 'ARS', cotizacion: 1200 }
        ]
      })
      .expect(201);

    const { body: cancelada } = await api()
      .post(`/api/ventas/${senada.id}/cancelar`)
      .set(taller.auth)
      .send({ motivo: 'Se arrepintió', devolverSena: true })
      .expect(200);
    expect(cancelada.pagado).toBe(0);
    const devoluciones = cancelada.pagos.filter((p: { tipo: string }) => p.tipo === 'devolucion');
    expect(devoluciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ moneda: 'USD', monto: '100.00', equivalente: '100.00' }),
        expect.objectContaining({ moneda: 'ARS', monto: '60000.00', equivalente: '50.00' })
      ])
    );
  });

  it('una reserva vencida vuelve el equipo al stock y queda registrada', async () => {
    const taller = await tallerConSucursal();
    const equipo = await iphoneEnStock(taller);

    const sinFecha = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1150 }],
        moneda: 'USD',
        modo: 'reserva'
      })
      .expect(400);
    expect(sinFecha.body.message).toContain('reserva');

    const { body: reserva } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1150 }],
        moneda: 'USD',
        modo: 'reserva',
        reservadaHasta: hoy()
      })
      .expect(201);
    expect(reserva).toMatchObject({ estado: 'reservada', saldo: 1150 });

    // Pasó la fecha.
    await Venta.update({ reservadaHasta: '2020-01-01' }, { where: { id: reserva.id } });
    const stock = await api().get(`/api/stock`).set(taller.auth).expect(200);
    expect(stock.body.equipos[0]).toMatchObject({ id: equipo.id, estado: 'disponible' });

    const vencida = await api().get(`/api/ventas/${reserva.id}`).set(taller.auth).expect(200);
    expect(vencida.body).toMatchObject({ estado: 'vencida', saldo: 0 });
    await api()
      .post(`/api/ventas/${reserva.id}/pagos`)
      .set(taller.auth)
      .send({ pagos: [{ monto: 1150, medioPago: 'efectivo' }] })
      .expect(409);
  });

  it('cancelar es de admin: la venta queda cancelada, el equipo vuelve y la seña se devuelve', async () => {
    const taller = await tallerConSucursal();
    const tecnico = await tecnicoDe(taller);
    const equipo = await iphoneEnStock(taller);

    const { body: senada } = await api()
      .post('/api/ventas')
      .set(tecnico.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1150 }],
        moneda: 'USD',
        modo: 'sena',
        pagos: [{ monto: 200, medioPago: 'efectivo' }]
      })
      .expect(201);

    await api().delete(`/api/ventas/${senada.id}`).set(taller.auth).expect(404);
    await api()
      .post(`/api/ventas/${senada.id}/cancelar`)
      .set(tecnico.auth)
      .send({ motivo: 'Se arrepintió' })
      .expect(403);
    const { body: cancelada } = await api()
      .post(`/api/ventas/${senada.id}/cancelar`)
      .set(taller.auth)
      .send({ motivo: 'Se arrepintió', devolverSena: true })
      .expect(200);
    expect(cancelada).toMatchObject({ estado: 'cancelada', motivoCancelacion: 'Se arrepintió', pagado: 0 });

    const vuelto = await api().get(`/api/stock/${equipo.id}`).set(taller.auth).expect(200);
    expect(vuelto.body.estado).toBe('disponible');
    const caja = await cajaDeHoy(taller);
    expect(caja.totales).toEqual([expect.objectContaining({ moneda: 'USD', cobrado: 0 })]);
    expect(caja.porOrigen).toEqual(
      expect.arrayContaining([expect.objectContaining({ clave: 'devolucion', total: -200 })])
    );
  });

  it('anular una venta completada la deja registrada, devuelve equipos y plata, y la saca del informe', async () => {
    const taller = await tallerConSucursal();
    const tecnico = await tecnicoDe(taller);
    const equipo = await iphoneEnStock(taller);

    // US$ 1.000: deja un iPhone 11 por US$ 200, paga US$ 500 y el resto en pesos.
    const { body: venta } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1000 }],
        moneda: 'USD',
        modo: 'venta',
        partesPago: [{ marca: 'Apple', modelo: 'iPhone 11', imei: IMEI_PARTE, monto: 200 }],
        pagos: [
          { monto: 500, medioPago: 'efectivo' },
          { monto: 360000, medioPago: 'efectivo', moneda: 'ARS', cotizacion: 1200 }
        ]
      })
      .expect(201);
    const parteId = venta.partesPago[0].equipoStockId;

    // Si lo que dejó ya está en otra venta, no se le puede devolver.
    const { body: reserva } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: { ...cliente, dniCuit: '30999888' },
        items: [{ equipoStockId: parteId, precio: 300 }],
        moneda: 'USD',
        modo: 'reserva',
        reservadaHasta: hoy()
      })
      .expect(201);
    const anular = { motivo: 'Devolvió el equipo', devolverPlata: true };
    const ocupado = await api()
      .post(`/api/ventas/${venta.id}/anular`)
      .set(taller.auth)
      .send(anular)
      .expect(409);
    expect(ocupado.body.message).toContain('otra venta');
    await api()
      .post(`/api/ventas/${reserva.id}/cancelar`)
      .set(taller.auth)
      .send({ motivo: 'No vino' })
      .expect(200);

    await api().post(`/api/ventas/${venta.id}/cancelar`).set(taller.auth).send(anular).expect(409);
    await api().post(`/api/ventas/${venta.id}/anular`).set(tecnico.auth).send(anular).expect(403);
    const { body: anulada } = await api()
      .post(`/api/ventas/${venta.id}/anular`)
      .set(taller.auth)
      .send(anular)
      .expect(200);
    expect(anulada).toMatchObject({
      estado: 'anulada',
      motivoCancelacion: 'Devolvió el equipo',
      pagado: 0,
      saldo: 0
    });
    expect(anulada.canceladaPor).toMatchObject({ id: expect.any(Number) });

    // El que se vendió vuelve al stock; el que dejó se le devuelve.
    const vuelto = await api().get(`/api/stock/${equipo.id}`).set(taller.auth).expect(200);
    expect(vuelto.body.estado).toBe('disponible');
    const devuelto = await api().get(`/api/stock/${parteId}`).set(taller.auth).expect(200);
    expect(devuelto.body).toMatchObject({ estado: 'baja', motivoBaja: expect.stringContaining('VTA-') });

    // La plata salió en las monedas en que entró: la caja queda en cero en cada una.
    const caja = await cajaDeHoy(taller);
    expect(caja.totales).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ moneda: 'USD', cobrado: 0 }),
        expect.objectContaining({ moneda: 'ARS', cobrado: 0 })
      ])
    );
    const informe = await api().get('/api/ventas/informe').set(taller.auth).expect(200);
    expect(informe.body.resumen).toMatchObject({ ventas: 0, brutoUsd: 0 });

    await api().post(`/api/ventas/${venta.id}/anular`).set(taller.auth).send(anular).expect(409);
    const anuladas = await api().get('/api/ventas').query({ estado: 'anulada' }).set(taller.auth).expect(200);
    expect(anuladas.body.map((v: { id: number }) => v.id)).toEqual([venta.id]);
    const pdf = await api().get(`/api/ventas/${venta.id}/pdf`).set(taller.auth).expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('a los 15 días de una seña sin completar avisa a los admins', async () => {
    const taller = await tallerConSucursal();
    const equipo = await iphoneEnStock(taller);
    const { body: senada } = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1150 }],
        moneda: 'USD',
        modo: 'sena',
        pagos: [{ monto: 200, medioPago: 'efectivo' }]
      })
      .expect(201);

    const haceDias = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);
    await sequelize.query('UPDATE ventas SET created_at = :fecha WHERE id = :id', {
      replacements: { fecha: haceDias, id: senada.id }
    });
    await sequelize.query('UPDATE venta_pagos SET created_at = :fecha WHERE venta_id = :id', {
      replacements: { fecha: haceDias, id: senada.id }
    });

    await api().get('/api/ventas').set(taller.auth).expect(200);
    await api().get('/api/ventas').set(taller.auth).expect(200);
    const avisos = await api().get('/api/notificaciones').set(taller.auth).expect(200);
    const deVenta = avisos.body.filter((a: { tipo: string }) => a.tipo === 'venta');
    expect(deVenta).toHaveLength(1);
    expect(deVenta[0]).toMatchObject({ link: `/ventas/${senada.id}` });

    // Sigue señada: no vuelve sola al stock.
    const equipoDespues = await api().get(`/api/stock/${equipo.id}`).set(taller.auth).expect(200);
    expect(equipoDespues.body.estado).toBe('senado');
  });

  it('el informe y los costos de la venta son solo para admin', async () => {
    const taller = await tallerConSucursal();
    const tecnico = await tecnicoDe(taller);
    const equipo = await iphoneEnStock(taller);
    const { body } = await api()
      .post('/api/ventas')
      .set(tecnico.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ equipoStockId: equipo.id, precio: 1150 }],
        moneda: 'USD',
        modo: 'venta',
        pagos: [{ monto: 1150, medioPago: 'efectivo' }]
      })
      .expect(201);
    expect(body.items[0].equipo).toMatchObject({ costo: null, costoUsd: null });

    await api().get('/api/ventas/informe').set(tecnico.auth).expect(403);
    await api().get('/api/reportes/resumen').set(tecnico.auth).expect(403);
    // La caja sí: el mostrador cierra el día.
    await api().get('/api/reportes/caja').set(tecnico.auth).expect(200);

    const lista = await api().get('/api/ventas').query({ search: IMEI }).set(tecnico.auth).expect(200);
    expect(lista.body.map((v: { id: number }) => v.id)).toEqual([body.id]);
  });
});
