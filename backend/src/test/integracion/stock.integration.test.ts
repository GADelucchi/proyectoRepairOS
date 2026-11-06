import { describe, expect, it } from 'vitest';
import { api, tallerConSucursal, type Sesion } from './helpers';

/** IMEI con el dígito de control bien: el que viene en el ejemplo de la norma. */
const IMEI = '490154203237518';
const OTRO_IMEI = '356789101234563';

const iphone = (datos: Record<string, unknown> = {}) => ({
  marca: 'Apple',
  modelo: 'iPhone 13',
  color: 'Medianoche',
  almacenamientoGb: 128,
  condicion: 'usado',
  bateria: 86,
  imei: IMEI,
  fechaCompra: '2026-11-05',
  monedaCosto: 'USD',
  costo: 900,
  precio: 1150,
  ...datos
});

/** Otra sucursal del mismo taller, con su propia sesión. */
async function otraSucursal(taller: Sesion) {
  const sucursal = await api().post('/api/sucursales').set(taller.auth).send({ nombre: 'Norte' }).expect(201);
  const sesion = await api()
    .post('/api/auth/seleccionar-sucursal')
    .set(taller.auth)
    .send({ sucursalId: sucursal.body.id })
    .expect(200);
  return { id: sucursal.body.id as number, auth: { Authorization: `Bearer ${sesion.body.token}` } };
}

describe('stock de equipos', () => {
  it('numera por taller y guarda el costo de cada unidad', async () => {
    const taller = await tallerConSucursal();

    const primero = await api()
      .post('/api/stock')
      .set(taller.auth)
      .send(iphone({ costo: 1000, imei: null, numeroSerie: 'F2LXK9QWN1' }))
      .expect(201);
    const segundo = await api().post('/api/stock').set(taller.auth).send(iphone()).expect(201);
    expect(primero.body).toMatchObject({ numero: 1, estado: 'disponible', costo: '1000.00', costoUsd: 1000 });
    expect(segundo.body).toMatchObject({ numero: 2, sucursalId: taller.sucursalId, monedaPrecio: 'USD' });

    // Otro taller arranca su propia numeración.
    const otro = await tallerConSucursal();
    const ajeno = await api().post('/api/stock').set(otro.auth).send(iphone()).expect(201);
    expect(ajeno.body.numero).toBe(1);

    const lista = await api().get('/api/stock').set(taller.auth).expect(200);
    expect(lista.body.equipos).toHaveLength(2);
    expect(lista.body.resumen).toMatchObject({ disponibles: 2, costoStockUsd: 1900 });
    expect(lista.body.resumen.porModelo).toEqual([
      expect.objectContaining({
        marca: 'Apple',
        modelo: 'iPhone 13',
        cantidad: 2,
        costos: [
          { moneda: 'USD', costo: 1000, cantidad: 1 },
          { moneda: 'USD', costo: 900, cantidad: 1 }
        ]
      })
    ]);

    // El equipo de otro taller no se ve.
    await api().get(`/api/stock/${ajeno.body.id}`).set(taller.auth).expect(404);
  });

  it('un costo en pesos se suma en dólares con la cotización del día de compra', async () => {
    const taller = await tallerConSucursal();
    const moto = {
      marca: 'Motorola',
      modelo: 'Edge 50',
      condicion: 'nuevo',
      imei: OTRO_IMEI,
      fechaCompra: '2026-11-05',
      monedaCosto: 'ARS',
      costo: 520000
    };

    await api().post('/api/stock').set(taller.auth).send(moto).expect(400);
    const creado = await api()
      .post('/api/stock')
      .set(taller.auth)
      .send({ ...moto, cotizacionCosto: 1150, bateria: 90 })
      .expect(201);
    expect(creado.body).toMatchObject({ costoUsd: 452.17, bateria: null });

    const lista = await api().get('/api/stock').set(taller.auth).expect(200);
    expect(lista.body.resumen.costoStockUsd).toBe(452.17);
  });

  it('no deja cargar dos veces el mismo IMEI', async () => {
    const taller = await tallerConSucursal();
    await api().post('/api/stock').set(taller.auth).send(iphone()).expect(201);
    const repetido = await api()
      .post('/api/stock')
      .set(taller.auth)
      .send(iphone({ imei: OTRO_IMEI, imei2: IMEI }))
      .expect(409);
    expect(repetido.body.message).toContain('#0001');
  });

  it('busca por IMEI, por número y por modelo', async () => {
    const taller = await tallerConSucursal();
    await api().post('/api/stock').set(taller.auth).send(iphone()).expect(201);
    await api()
      .post('/api/stock')
      .set(taller.auth)
      .send(iphone({ modelo: 'iPhone 15 Pro', imei: OTRO_IMEI }))
      .expect(201);

    const porImei = await api().get('/api/stock').query({ search: IMEI }).set(taller.auth).expect(200);
    expect(porImei.body.equipos.map((e: { numero: number }) => e.numero)).toEqual([1]);
    const porNumero = await api().get('/api/stock').query({ search: '#2' }).set(taller.auth).expect(200);
    expect(porNumero.body.equipos.map((e: { modelo: string }) => e.modelo)).toEqual(['iPhone 15 Pro']);
    const porModelo = await api().get('/api/stock').query({ search: '15 pro' }).set(taller.auth).expect(200);
    expect(porModelo.body.equipos).toHaveLength(1);
  });

  it('cada sucursal ve su stock, salvo que el taller lo comparta', async () => {
    const taller = await tallerConSucursal();
    const norte = await otraSucursal(taller);
    const delNorte = await api().post('/api/stock').set(norte.auth).send(iphone()).expect(201);

    const central = await api().get('/api/stock').set(taller.auth).expect(200);
    expect(central.body.equipos).toHaveLength(0);
    await api().get(`/api/stock/${delNorte.body.id}`).set(taller.auth).expect(404);
    await api().get('/api/stock').query({ sucursal: 'todas' }).set(taller.auth).expect(403);

    await api()
      .put('/api/configuracion/taller')
      .set(taller.auth)
      .send({ stockEntreSucursales: true })
      .expect(200);

    const todas = await api().get('/api/stock').query({ sucursal: 'todas' }).set(taller.auth).expect(200);
    expect(todas.body.equipos).toHaveLength(1);
    const soloNorte = await api()
      .get('/api/stock')
      .query({ sucursal: norte.id })
      .set(taller.auth)
      .expect(200);
    expect(soloNorte.body.equipos[0].sucursal).toMatchObject({ nombre: 'Norte' });
    await api().get(`/api/stock/${delNorte.body.id}`).set(taller.auth).expect(200);
  });

  it('edita y borra un equipo disponible', async () => {
    const taller = await tallerConSucursal();
    const creado = await api().post('/api/stock').set(taller.auth).send(iphone()).expect(201);

    const editado = await api()
      .put(`/api/stock/${creado.body.id}`)
      .set(taller.auth)
      .send(iphone({ precio: 1200, color: 'Azul' }))
      .expect(200);
    expect(editado.body).toMatchObject({ precio: '1200.00', color: 'Azul', numero: 1 });

    await api().delete(`/api/stock/${creado.body.id}`).set(taller.auth).expect(204);
    await api().get(`/api/stock/${creado.body.id}`).set(taller.auth).expect(404);
  });
});
