import { describe, expect, it } from 'vitest';
import { api, crearOrden, tallerConSucursal, tecnicoDe, type Sesion } from './helpers';

/** Otra sucursal del mismo taller, con su propia sesión (de admin). */
async function otraSucursal(taller: Sesion) {
  const sucursal = await api().post('/api/sucursales').set(taller.auth).send({ nombre: 'Norte' }).expect(201);
  const sesion = await api()
    .post('/api/auth/seleccionar-sucursal')
    .set(taller.auth)
    .send({ sucursalId: sucursal.body.id })
    .expect(200);
  return { id: sucursal.body.id as number, auth: { Authorization: `Bearer ${sesion.body.token}` } };
}

/** Un módulo con dos entradas: 10 en pesos a US$ 100 (cot. 1150), y después 5 a US$ 120. */
async function moduloConDosEntradas(taller: Sesion) {
  const categoria = await api()
    .post('/api/inventario/categorias')
    .set(taller.auth)
    .send({ grupo: 'repuesto', nombre: 'Módulos' })
    .expect(201);
  const creado = await api()
    .post('/api/inventario/articulos')
    .set(taller.auth)
    .send({
      tipo: 'repuesto',
      categoriaId: categoria.body.id,
      nombre: 'Módulo iPhone 15 Pro OLED IC',
      codigoBarras: '7798123456789',
      stockMinimo: 3,
      precios: [{ monto: 190, moneda: 'USD' }, { monto: 175, moneda: 'USD' }, null],
      entrada: {
        cantidad: 10,
        moneda: 'ARS',
        costo: 115000,
        cotizacion: 1150,
        fecha: '2026-10-12',
        proveedor: 'Casa Repuestos'
      }
    })
    .expect(201);
  await api()
    .post('/api/inventario/entradas')
    .set(taller.auth)
    .send({
      moneda: 'USD',
      fecha: '2026-11-14',
      proveedor: 'Importadora Sur',
      lineas: [{ articuloId: creado.body.id, cantidad: 5, costo: 120 }]
    })
    .expect(201);
  return creado.body as { id: number; codigo: string };
}

const detalle = (sesion: { auth: Record<string, string> }, id: number, query: Record<string, unknown> = {}) =>
  api().get(`/api/inventario/articulos/${id}`).query(query).set(sesion.auth).expect(200);

describe('inventario: productos y entradas', () => {
  it('cada entrada guarda su costo; el listado suma la cantidad y agrupa por costo', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    expect(modulo.codigo).toBe('R-0001');

    const { body } = await api()
      .get('/api/inventario/articulos')
      .query({ tipo: 'productos' })
      .set(taller.auth)
      .expect(200);
    const [fila] = body.articulos;
    expect(fila).toMatchObject({
      nombre: 'Módulo iPhone 15 Pro OLED IC',
      cantidad: 15,
      categoria: { nombre: 'Módulos' },
      costos: [
        { moneda: 'ARS', costo: 115000, costoUsd: 100, cantidad: 10 },
        { moneda: 'USD', costo: 120, costoUsd: 120, cantidad: 5 }
      ],
      costoStockUsd: 1600
    });
    expect(fila.precios).toEqual([
      { posicion: 1, nombre: 'Lista', monto: 190, moneda: 'USD' },
      { posicion: 2, nombre: 'Efectivo', monto: 175, moneda: 'USD' },
      { posicion: 3, nombre: 'Tarjeta', monto: null, moneda: null }
    ]);
    expect(body.resumen).toMatchObject({ productos: 1, unidades: 15, costoStockUsd: 1600, bajoMinimo: 0 });

    // El escáner lo encuentra por código de barras.
    const escaneado = await api()
      .get('/api/inventario/articulos/codigo')
      .query({ codigo: '7798123456789' })
      .set(taller.auth)
      .expect(200);
    expect(escaneado.body.id).toBe(modulo.id);

    // Un técnico ve cantidades y precios, pero no costos.
    const tecnico = await tecnicoDe(taller);
    const suyo = await detalle(tecnico, modulo.id);
    expect(suyo.body).toMatchObject({ cantidad: 15, costos: null, costoStockUsd: null });
    expect(suyo.body.entradas[0]).toMatchObject({ disponible: 10, costo: null, costoUsd: null });
  });

  it('los nombres de los precios son del taller: se pueden borrar y renombrar', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    await api()
      .put('/api/inventario/config')
      .set(taller.auth)
      .send({
        precios: ['Lista', null, 'Tarjeta 3 cuotas'],
        stockMinimoPorDefecto: 2,
        avisoApp: true,
        avisoEmail: false,
        prefijos: { repuesto: 'REP-', accesorio: 'A-', servicio: 'S-' }
      })
      .expect(200);
    const { body } = await detalle(taller, modulo.id);
    expect(body.precios.map((p: { nombre: string }) => p.nombre)).toEqual(['Lista', 'Tarjeta 3 cuotas']);

    const otro = await api()
      .post('/api/inventario/articulos')
      .set(taller.auth)
      .send({ tipo: 'repuesto', nombre: 'Batería iPhone 13' })
      .expect(201);
    expect(otro.body).toMatchObject({ codigo: 'REP-0002', stockMinimo: 2 });
  });
});

describe('inventario: repuestos en las órdenes', () => {
  it('usa primero lo más viejo, se puede elegir otra entrada, y la orden muestra su costo y ganancia', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    const adhesivo = await api()
      .post('/api/inventario/articulos')
      .set(taller.auth)
      .send({
        tipo: 'repuesto',
        nombre: 'Adhesivo pantalla',
        entrada: { cantidad: 20, moneda: 'USD', costo: 3 }
      })
      .expect(201);
    const servicio = await api()
      .post('/api/inventario/articulos')
      .set(taller.auth)
      .send({
        tipo: 'servicio',
        nombre: 'Cambio de módulo iPhone 15 Pro',
        precios: [{ monto: 260, moneda: 'USD' }],
        repuestos: [
          { repuestoId: modulo.id, cantidad: 1 },
          { repuestoId: adhesivo.body.id, cantidad: 1 }
        ]
      })
      .expect(201);
    expect(servicio.body).toMatchObject({ codigo: 'S-0001', cantidad: null, costoHoyUsd: 103 });

    const orden = await crearOrden(taller, { moneda: 'USD', presupuestoMonto: 260 });
    const ruta = `/api/ordenes/${orden.id}`;
    await api().post(`${ruta}/repuestos`).set(taller.auth).send({ servicioId: servicio.body.id }).expect(201);
    const conSuelto = await api()
      .post(`${ruta}/repuestos`)
      .set(taller.auth)
      .send({ articuloId: modulo.id, cantidad: 1 })
      .expect(201);

    const [agregado] = conSuelto.body.inventario.servicios;
    expect(agregado.nombre).toBe('Cambio de módulo iPhone 15 Pro');
    expect(agregado.repuestos.map((r: { costoUsd: number }) => r.costoUsd)).toEqual([100, 3]);
    const [suelto] = conSuelto.body.inventario.repuestos;
    expect(suelto).toMatchObject({ cantidad: 1, costoUsd: 100, entrada: { costo: 115000, moneda: 'ARS' } });

    // Elegir la entrada de US$ 120 para el suelto.
    const { body: articulo } = await detalle(taller, modulo.id);
    expect(articulo.cantidad).toBe(13);
    const nueva = articulo.entradas.find((e: { costoUsd: number }) => e.costoUsd === 120);
    const cambiado = await api()
      .post(`${ruta}/repuestos/${suelto.id}/entrada`)
      .set(taller.auth)
      .send({ entradaId: nueva.id })
      .expect(200);
    expect(cambiado.body.inventario.repuestos[0].costoUsd).toBe(120);
    expect(cambiado.body.costos).toMatchObject({
      base: 'presupuesto',
      baseUsd: 260,
      repuestosUsd: 223,
      gananciaUsd: 37
    });

    // El técnico ve qué tiene la orden, pero no los costos.
    const tecnico = await tecnicoDe(taller);
    const vista = await api().get(ruta).set(tecnico.auth).expect(200);
    expect(vista.body.costos).toBeNull();
    expect(vista.body.inventario.repuestos[0].costoUsd).toBeNull();

    // Quitar el suelto lo devuelve a su entrada.
    await api()
      .delete(`${ruta}/repuestos/${cambiado.body.inventario.repuestos[0].id}`)
      .set(taller.auth)
      .expect(200);
    const despues = await detalle(taller, modulo.id);
    expect(despues.body.cantidad).toBe(14);
    expect(despues.body.entradas.map((e: { disponible: number }) => e.disponible)).toEqual([9, 5]);
    expect(despues.body.movimientos.map((m: { tipo: string }) => m.tipo)).toContain('orden_devolucion');
  });

  it('al cancelar pide qué pasa con cada repuesto: lo perdido queda como costo', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    const orden = await crearOrden(taller);
    const ruta = `/api/ordenes/${orden.id}`;
    const { body } = await api()
      .post(`${ruta}/repuestos`)
      .set(taller.auth)
      .send({ articuloId: modulo.id, cantidad: 2 })
      .expect(201);
    const [consumo] = body.inventario.repuestos;

    const sinDecidir = await api()
      .put(`${ruta}/estado`)
      .set(taller.auth)
      .send({ estado: 'cancelado' })
      .expect(409);
    expect(sinDecidir.body.message).toContain('Módulo iPhone 15 Pro');

    await api()
      .put(`${ruta}/estado`)
      .set(taller.auth)
      .send({
        estado: 'cancelado',
        repuestos: [{ consumoId: consumo.id, destino: 'perdido', motivo: 'Se rompió el flex' }]
      })
      .expect(200);
    const final = await api().get(ruta).set(taller.auth).expect(200);
    expect(final.body.inventario.repuestos[0]).toMatchObject({
      estado: 'perdido',
      motivo: 'Se rompió el flex'
    });
    expect(final.body.costos).toMatchObject({ repuestosUsd: 200, perdidosUsd: 200 });
    expect((await detalle(taller, modulo.id)).body.cantidad).toBe(13);
  });

  it('avisa una vez cuando una sucursal queda por debajo del mínimo', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    const orden = await crearOrden(taller);
    const usar = (cantidad: number) =>
      api()
        .post(`/api/ordenes/${orden.id}/repuestos`)
        .set(taller.auth)
        .send({ articuloId: modulo.id, cantidad })
        .expect(201);
    const avisos = async () => {
      // El aviso sale después de confirmar la transacción.
      await new Promise((r) => setTimeout(r, 300));
      const { body } = await api().get('/api/notificaciones').set(taller.auth).expect(200);
      const lista: { tipo: string; titulo: string }[] = Array.isArray(body) ? body : body.notificaciones;
      return lista.filter((n) => n.tipo === 'inventario');
    };

    await usar(12); // Quedan 3: el mínimo, todavía no avisa.
    expect(await avisos()).toHaveLength(0);
    await usar(1); // Quedan 2.
    const primero = await avisos();
    expect(primero).toHaveLength(1);
    expect(primero[0].titulo).toBe('Quedan 2 de Módulo iPhone 15 Pro OLED IC');
    await usar(1); // Ya estaba por debajo: no vuelve a avisar.
    expect(await avisos()).toHaveLength(1);

    const { body } = await api()
      .get('/api/inventario/articulos')
      .query({ bajoMinimo: 'true' })
      .set(taller.auth);
    expect(body.articulos.map((a: { id: number }) => a.id)).toEqual([modulo.id]);
  });
});

describe('informe de reparaciones', () => {
  it('cobrado en pesos con su cotización, menos repuestos y lo que cobró el externo', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    const orden = await crearOrden(taller, { moneda: 'ARS', presupuestoMonto: 300000 });
    const ruta = `/api/ordenes/${orden.id}`;
    await api().post(`${ruta}/repuestos`).set(taller.auth).send({ articuloId: modulo.id }).expect(201);

    // Antes de entregar, la ganancia se estima con la última cotización que usó el taller.
    const antes = await api().get(ruta).set(taller.auth).expect(200);
    expect(antes.body.costos).toMatchObject({
      base: 'presupuesto',
      cotizacion: 1150,
      cotizacionEstimada: true
    });

    // Tercerizada a un externo que cobró US$ 40.
    await api().put(`${ruta}/estado`).set(taller.auth).send({ estado: 'en_reparacion' }).expect(200);
    const envio = await api()
      .post(`${ruta}/tercerizar`)
      .set(taller.auth)
      .send({ nombre: 'Técnico de placas', trabajo: 'Reballing' })
      .expect(200);
    const detalleOrden = await api().get(ruta).set(taller.auth).expect(200);
    const tercerizacionId = detalleOrden.body.tercerizaciones[0].id;
    expect(envio.body.estado).toBe('externo');
    await api()
      .put(`${ruta}/tercerizaciones/${tercerizacionId}/costo`)
      .set(taller.auth)
      .send({ moneda: 'USD', monto: 40 })
      .expect(200);
    await api().put(`${ruta}/estado`).set(taller.auth).send({ estado: 'listo_para_retirar' }).expect(200);
    await api()
      .post(`${ruta}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 300000, montoAbonado: 300000, medioPago: 'efectivo', cotizacion: 1200 })
      .expect(200);

    const { body } = await api().get('/api/reportes/reparaciones').set(taller.auth).expect(200);
    expect(body.ordenes[0]).toMatchObject({
      numeroOrden: orden.numeroOrden,
      moneda: 'ARS',
      cobrado: 300000,
      cotizacion: 1200,
      cobradoUsd: 250,
      repuestosUsd: 100,
      externoUsd: 40,
      gananciaUsd: 110,
      margen: 44
    });
    expect(body.resumen).toMatchObject({ entregadas: 1, gananciaUsd: 110, sinCotizacion: 0 });

    // El técnico no ve el informe.
    const tecnico = await tecnicoDe(taller);
    await api().get('/api/reportes/reparaciones').set(tecnico.auth).expect(403);
  });
});

describe('inventario: ventas de accesorios', () => {
  it('salen del stock al vender y vuelven si se cancela la reserva; el costo va al informe', async () => {
    const taller = await tallerConSucursal();
    const funda = await api()
      .post('/api/inventario/articulos')
      .set(taller.auth)
      .send({
        tipo: 'accesorio',
        nombre: 'Funda silicona iPhone 15',
        precios: [{ monto: 15000, moneda: 'ARS' }],
        entrada: { cantidad: 24, moneda: 'USD', costo: 4 }
      })
      .expect(201);
    const cliente = { nombre: 'Martín', apellido: 'Sosa', telefono: '221 555-0000' };

    const reserva = await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ articuloId: funda.body.id, cantidad: 2, precio: 15000 }],
        moneda: 'ARS',
        cotizacion: 1200,
        modo: 'reserva',
        reservadaHasta: '2099-01-01'
      })
      .expect(201);
    expect(reserva.body.total).toBe('30000.00');
    expect((await detalle(taller, funda.body.id)).body.cantidad).toBe(22);
    await api()
      .post(`/api/ventas/${reserva.body.id}/cancelar`)
      .set(taller.auth)
      .send({ motivo: 'Se arrepintió' })
      .expect(200);
    expect((await detalle(taller, funda.body.id)).body.cantidad).toBe(24);

    await api()
      .post('/api/ventas')
      .set(taller.auth)
      .send({
        nuevoCliente: cliente,
        items: [{ articuloId: funda.body.id, cantidad: 3, precio: 12000 }],
        moneda: 'ARS',
        cotizacion: 1200,
        modo: 'venta',
        pagos: [{ monto: 36000, medioPago: 'efectivo' }]
      })
      .expect(201);
    expect((await detalle(taller, funda.body.id)).body.cantidad).toBe(21);

    const informe = await api().get('/api/ventas/informe').set(taller.auth).expect(200);
    expect(informe.body.ventas[0]).toMatchObject({ brutoUsd: 30, costoUsd: 12, gananciaUsd: 18 });
    expect(informe.body.ventas[0].articulos).toEqual([
      { codigo: 'A-0001', nombre: 'Funda silicona iPhone 15', cantidad: 3 }
    ]);
  });
});

describe('inventario: pases entre sucursales', () => {
  it('queda en camino hasta que la otra sucursal lo recibe; las unidades conservan su costo', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    const equipo = await api()
      .post('/api/stock')
      .set(taller.auth)
      .send({
        marca: 'Apple',
        modelo: 'iPhone 11',
        condicion: 'usado',
        numeroSerie: 'PASE11',
        fechaCompra: '2026-10-30',
        monedaCosto: 'USD',
        costo: 250
      })
      .expect(201);
    const norte = await otraSucursal(taller);
    // Una compra en pesos posterior a la del módulo, con otra cotización.
    await api()
      .post('/api/inventario/articulos')
      .set(taller.auth)
      .send({
        tipo: 'accesorio',
        nombre: 'Funda',
        entrada: { cantidad: 1, moneda: 'ARS', costo: 2600, cotizacion: 1300, fecha: '2026-11-15' }
      })
      .expect(201);

    const pase = await api()
      .post('/api/inventario/pases')
      .set(taller.auth)
      .send({
        sucursalDestinoId: norte.id,
        nota: 'Lo lleva Martín',
        items: [{ articuloId: modulo.id, cantidad: 2 }, { equipoStockId: equipo.body.id }]
      })
      .expect(201);
    expect(pase.body).toMatchObject({ etiqueta: 'P-0001', estado: 'en_camino' });
    expect((await detalle(taller, modulo.id)).body.cantidad).toBe(13);
    expect((await detalle(norte, modulo.id)).body.cantidad).toBe(0);
    const enCamino = await api().get(`/api/stock/${equipo.body.id}`).set(taller.auth).expect(200);
    expect(enCamino.body.estado).toBe('en_camino');

    // Las dos sucursales lo ven en su lista, en camino primero.
    const lista = await api().get('/api/inventario/pases').set(norte.auth).expect(200);
    expect(lista.body.pases[0]).toMatchObject({ id: pase.body.id, estado: 'en_camino' });
    expect(lista.body.sucursales.map((s: { id: number }) => s.id)).toEqual([taller.sucursalId]);

    // La que manda no puede confirmar la recepción.
    await api().post(`/api/inventario/pases/${pase.body.id}/recibir`).set(taller.auth).expect(403);
    await api().post(`/api/inventario/pases/${pase.body.id}/recibir`).set(norte.auth).expect(200);

    const enNorte = await detalle(norte, modulo.id);
    expect(enNorte.body.cantidad).toBe(2);
    expect(enNorte.body.entradas[0]).toMatchObject({
      disponible: 2,
      costoUsd: 100,
      fecha: '2026-10-12',
      origen: 'pase'
    });
    const equipoNorte = await api().get(`/api/stock/${equipo.body.id}`).set(norte.auth).expect(200);
    expect(equipoNorte.body).toMatchObject({ estado: 'disponible', sucursalId: norte.id });

    // Lo recibido copia la cotización de la compra vieja: no cuenta como la última.
    const sugerida = await api()
      .get('/api/inventario/cotizacion')
      .query({ moneda: 'ARS' })
      .set(norte.auth)
      .expect(200);
    expect(sugerida.body.cotizacion).toBe(1300);
  });

  it('cancelar un pase en camino devuelve todo a la sucursal origen', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    const norte = await otraSucursal(taller);
    const pase = await api()
      .post('/api/inventario/pases')
      .set(taller.auth)
      .send({ sucursalDestinoId: norte.id, items: [{ articuloId: modulo.id, cantidad: 12 }] })
      .expect(201);
    expect((await detalle(taller, modulo.id)).body.cantidad).toBe(3);
    await api().post(`/api/inventario/pases/${pase.body.id}/cancelar`).set(taller.auth).expect(200);
    const vuelta = await detalle(taller, modulo.id);
    expect(vuelta.body.entradas.map((e: { disponible: number }) => e.disponible)).toEqual([10, 5]);
  });
});

describe('inventario: repuestos en equipos del stock', () => {
  it('suman al costo del equipo y vuelven al anular el costo', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller);
    const equipo = await api()
      .post('/api/stock')
      .set(taller.auth)
      .send({
        marca: 'Apple',
        modelo: 'iPhone 15 Pro',
        condicion: 'usado',
        numeroSerie: 'STOCK15PRO',
        fechaCompra: '2026-11-01',
        monedaCosto: 'USD',
        costo: 600
      })
      .expect(201);
    const conRepuesto = await api()
      .post(`/api/stock/${equipo.body.id}/repuestos`)
      .set(taller.auth)
      .send({ articuloId: modulo.id })
      .expect(201);
    expect(conRepuesto.body).toMatchObject({ costoReparacionesUsd: 100, costoUsd: 700 });
    expect((await detalle(taller, modulo.id)).body.cantidad).toBe(14);

    const [costo] = conRepuesto.body.costosReparacion;
    expect(costo.concepto).toBe('Módulo iPhone 15 Pro OLED IC');
    await api().post(`/api/stock/${equipo.body.id}/costos/${costo.id}/anular`).set(taller.auth).expect(200);
    expect((await detalle(taller, modulo.id)).body.cantidad).toBe(15);
  });
});

describe('inventario: ajuste por conteo', () => {
  it('lo hace solo un admin: lo que falta sale de lo más viejo y lo que sobra entra al costo de la última compra', async () => {
    const taller = await tallerConSucursal();
    const modulo = await moduloConDosEntradas(taller); // 10 a US$ 100 y 5 a US$ 120
    const ruta = `/api/inventario/articulos/${modulo.id}/ajuste`;

    const tecnico = await tecnicoDe(taller);
    await api()
      .post(ruta)
      .set(tecnico.auth)
      .send({ cantidadContada: 12, motivo: 'Conteo de fin de mes' })
      .expect(403);

    // Se contaron 12: faltan 3, salen de la entrada más vieja.
    const menos = await api()
      .post(ruta)
      .set(taller.auth)
      .send({ cantidadContada: 12, motivo: 'Conteo de fin de mes' })
      .expect(200);
    expect(menos.body).toMatchObject({ habia: 15, contada: 12, diferencia: -3 });
    expect(menos.body.articulo.entradas.map((e: { disponible: number }) => e.disponible)).toEqual([7, 5]);
    expect(menos.body.articulo.movimientos[0]).toMatchObject({ tipo: 'ajuste', cantidad: -3 });
    expect(menos.body.articulo.movimientos[0].nota).toContain('había 15, se contaron 12');

    // Aparecieron 2: entran al costo de la última compra (US$ 120).
    const mas = await api()
      .post(ruta)
      .set(taller.auth)
      .send({ cantidadContada: 14, motivo: 'Estaban en otro cajón' })
      .expect(200);
    expect(mas.body.diferencia).toBe(2);
    const ajuste = mas.body.articulo.entradas.find((e: { origen: string }) => e.origen === 'ajuste');
    expect(ajuste).toMatchObject({ cantidad: 2, disponible: 2, costoUsd: 120 });
    expect(mas.body.articulo.cantidad).toBe(14);

    // Un producto sin compras necesita el costo.
    const nuevo = await api()
      .post('/api/inventario/articulos')
      .set(taller.auth)
      .send({ tipo: 'accesorio', nombre: 'Vidrio templado' })
      .expect(201);
    const sinCosto = await api()
      .post(`/api/inventario/articulos/${nuevo.body.id}/ajuste`)
      .set(taller.auth)
      .send({ cantidadContada: 5, motivo: 'Inventario inicial' })
      .expect(400);
    expect(sinCosto.body.message).toContain('cuánto costó');
    await api()
      .post(`/api/inventario/articulos/${nuevo.body.id}/ajuste`)
      .set(taller.auth)
      .send({ cantidadContada: 5, motivo: 'Inventario inicial', costo: { moneda: 'USD', monto: 1 } })
      .expect(200);
  });
});
