import { describe, expect, it } from 'vitest';
import { api, tallerConSucursal, tecnicoDe, type Sesion } from './helpers';

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
      .send(iphone({ costo: 1000, imei: null, numeroSerie: 'f2lxk9qwn1' }))
      .expect(201);
    // El serial se guarda en mayúsculas, se haya escrito como se haya escrito.
    expect(primero.body.numeroSerie).toBe('F2LXK9QWN1');
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

  it('edita un equipo y lo da de baja sin borrarlo', async () => {
    const taller = await tallerConSucursal();
    const creado = await api().post('/api/stock').set(taller.auth).send(iphone()).expect(201);

    const editado = await api()
      .put(`/api/stock/${creado.body.id}`)
      .set(taller.auth)
      .send(iphone({ precio: 1200, color: 'Azul' }))
      .expect(200);
    expect(editado.body).toMatchObject({ precio: '1200.00', color: 'Azul', numero: 1 });

    // No hay forma de borrarlo: solo darlo de baja, con el motivo, y siendo admin.
    await api().delete(`/api/stock/${creado.body.id}`).set(taller.auth).expect(404);
    await api().post(`/api/stock/${creado.body.id}/baja`).set(taller.auth).send({}).expect(400);
    const tecnico = await tecnicoDe(taller);
    await api()
      .post(`/api/stock/${creado.body.id}/baja`)
      .set(tecnico.auth)
      .send({ motivo: 'Carga duplicada' })
      .expect(403);
    const baja = await api()
      .post(`/api/stock/${creado.body.id}/baja`)
      .set(taller.auth)
      .send({ motivo: 'Carga duplicada' })
      .expect(200);
    expect(baja.body).toMatchObject({ estado: 'baja', motivoBaja: 'Carga duplicada' });

    // Sigue existiendo, pero fuera del listado y del valor del stock; su IMEI se puede volver a cargar.
    await api().get(`/api/stock/${creado.body.id}`).set(taller.auth).expect(200);
    const lista = await api().get('/api/stock').set(taller.auth).expect(200);
    expect(lista.body.equipos).toHaveLength(0);
    expect(lista.body.resumen).toMatchObject({ bajas: 1, costoStockUsd: 0 });
    const bajas = await api().get('/api/stock').query({ estado: 'baja' }).set(taller.auth).expect(200);
    expect(bajas.body.equipos).toHaveLength(1);
    await api().post('/api/stock').set(taller.auth).send(iphone()).expect(201);
  });

  it('avisa si un IMEI o un serial ya está en el stock antes de guardar', async () => {
    const taller = await tallerConSucursal();
    const creado = await api()
      .post('/api/stock')
      .set(taller.auth)
      .send(iphone({ numeroSerie: 'F2LXK9QWN1' }))
      .expect(201);

    const porImei = await api()
      .get('/api/stock/verificar')
      .query({ imei: IMEI })
      .set(taller.auth)
      .expect(200);
    expect(porImei.body.repetido).toMatchObject({ etiqueta: '#0001', modelo: 'iPhone 13' });
    const porSerial = await api()
      .get('/api/stock/verificar')
      .query({ numeroSerie: 'F2LXK9QWN1' })
      .set(taller.auth)
      .expect(200);
    expect(porSerial.body.repetido.id).toBe(creado.body.id);
    // El equipo que se está editando no cuenta.
    const propio = await api()
      .get('/api/stock/verificar')
      .query({ imei: IMEI, excluirId: creado.body.id })
      .set(taller.auth)
      .expect(200);
    expect(propio.body.repetido).toBeNull();
  });

  it('los costos de reparación suman al costo del equipo y a la ganancia de la venta', async () => {
    const taller = await tallerConSucursal();
    const tecnico = await tecnicoDe(taller);
    const { body: equipo } = await api()
      .post('/api/stock')
      .set(taller.auth)
      .send(iphone({ modelo: 'iPhone 14', costo: 190, precio: 400 }))
      .expect(201);

    // Batería US$ 35 y mano de obra en pesos: 12.000 a 1.200 son US$ 10.
    await api()
      .post(`/api/stock/${equipo.id}/costos`)
      .set(taller.auth)
      .send({ concepto: 'Batería', moneda: 'USD', monto: 35 })
      .expect(201);
    await api()
      .post(`/api/stock/${equipo.id}/costos`)
      .set(taller.auth)
      .send({ concepto: 'Mano de obra', moneda: 'ARS', monto: 12000 })
      .expect(400);
    const { body: conCostos } = await api()
      .post(`/api/stock/${equipo.id}/costos`)
      .set(taller.auth)
      .send({ concepto: 'Mano de obra', moneda: 'ARS', monto: 12000, cotizacion: 1200 })
      .expect(201);
    expect(conCostos).toMatchObject({ costoCompraUsd: 190, costoReparacionesUsd: 45, costoUsd: 235 });
    expect(conCostos.costosReparacion).toHaveLength(2);

    // Uno cargado por error se anula: queda, pero no suma.
    const { body: anulado } = await api()
      .post(`/api/stock/${equipo.id}/costos/${conCostos.costosReparacion[1].id}/anular`)
      .set(taller.auth)
      .expect(200);
    expect(anulado).toMatchObject({ costoReparacionesUsd: 35, costoUsd: 225 });
    expect(anulado.costosReparacion[1].anuladoEn).toBeTruthy();

    const lista = await api().get('/api/stock').set(taller.auth).expect(200);
    expect(lista.body.resumen.costoStockUsd).toBe(225);

    // Es de admin: el técnico no los carga ni los ve.
    await api()
      .post(`/api/stock/${equipo.id}/costos`)
      .set(tecnico.auth)
      .send({ concepto: 'Pantalla', moneda: 'USD', monto: 80 })
      .expect(403);
    const visto = await api().get(`/api/stock/${equipo.id}`).set(tecnico.auth).expect(200);
    expect(visto.body).toMatchObject({ costoUsd: null, costoReparacionesUsd: null });
    expect(visto.body.costosReparacion).toBeUndefined();

    // Vendido a US$ 400: la ganancia es 400 - 225. Un costo después de vender la baja.
    await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: { nombre: 'Ana', apellido: 'Paz', telefono: '221 555-0001' },
        items: [{ equipoStockId: equipo.id, precio: 400 }],
        moneda: 'USD',
        modo: 'venta',
        pagos: [{ monto: 400, medioPago: 'efectivo' }]
      })
      .expect(201);
    const informe = () => api().get('/api/ventas/informe').set(taller.auth).expect(200);
    expect((await informe()).body.resumen).toMatchObject({ costoUsd: 225, gananciaUsd: 175 });

    await api()
      .post(`/api/stock/${equipo.id}/costos`)
      .set(taller.auth)
      .send({ concepto: 'Garantía: cambio de pantalla', moneda: 'USD', monto: 60 })
      .expect(201);
    expect((await informe()).body.resumen).toMatchObject({ costoUsd: 285, gananciaUsd: 115 });
  });

  it('sugiere los proveedores ya usados, el último primero', async () => {
    const taller = await tallerConSucursal();
    const cargar = (proveedor: string | null, numeroSerie: string) =>
      api()
        .post('/api/stock')
        .set(taller.auth)
        .send(iphone({ proveedor, imei: null, numeroSerie }))
        .expect(201);
    await cargar('Distribuidora Once', 'SERIE001');
    await cargar('Importadora del Sur', 'SERIE002');
    await cargar('Distribuidora Once', 'SERIE003');
    await cargar(null, 'SERIE004');

    const { body } = await api().get('/api/stock/proveedores').set(taller.auth).expect(200);
    expect(body).toEqual(['Distribuidora Once', 'Importadora del Sur']);

    // Otro taller no ve los proveedores de este.
    const otro = await tallerConSucursal();
    await api().get('/api/stock/proveedores').set(otro.auth).expect(200, []);
  });

  it('los costos los ve solo un admin, y un técnico que edita no los cambia', async () => {
    const taller = await tallerConSucursal();
    const tecnico = await tecnicoDe(taller);

    // El técnico puede cargar (con el costo que pagó), pero después no lo ve.
    const cargado = await api().post('/api/stock').set(tecnico.auth).send(iphone()).expect(201);
    expect(cargado.body).toMatchObject({ costo: null, costoUsd: null, precio: '1150.00' });
    const lista = await api().get('/api/stock').set(tecnico.auth).expect(200);
    expect(lista.body.resumen.costoStockUsd).toBeNull();
    expect(lista.body.resumen.porModelo[0]).toMatchObject({ cantidad: 1, costos: [] });

    await api()
      .put(`/api/stock/${cargado.body.id}`)
      .set(tecnico.auth)
      .send(iphone({ costo: 1, color: 'Rojo' }))
      .expect(200);
    const visto = await api().get(`/api/stock/${cargado.body.id}`).set(taller.auth).expect(200);
    expect(visto.body).toMatchObject({ costo: '900.00', color: 'Rojo', costoUsd: 900 });
  });
});
