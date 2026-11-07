import { describe, expect, it } from 'vitest';
import { api, crearOrden, tallerConSucursal, tecnicoDe, type Sesion } from './helpers';

describe('moneda', () => {
  it('una orden sin moneda toma la del país del taller', async () => {
    const taller = await tallerConSucursal({ pais: 'CL' });
    const orden = await crearOrden(taller, { presupuestoMonto: 50000 });
    expect(orden.moneda).toBe('CLP');
  });

  it('la entrega en dólares deja la deuda en dólares, separada de los pesos', async () => {
    const taller = await tallerConSucursal();
    const enDolares = await crearOrden(taller, { moneda: 'USD', presupuestoMonto: 100 });
    const clienteId = enDolares.clienteId;

    // Cuenta corriente para poder fiar.
    await api()
      .put(`/api/clientes/${clienteId}`)
      .set(taller.auth)
      .send({ cuentaCorrienteHabilitada: true })
      .expect(200);

    const ruta = `/api/ordenes/${enDolares.id}`;
    for (const estado of ['en_diagnostico', 'presupuestado', 'aprobado', 'listo_para_retirar']) {
      await api()
        .put(`${ruta}/estado`)
        .set(taller.auth)
        .send({ estado, notaInterna: `nota ${estado}` })
        .expect(200);
    }
    const entrega = await api()
      .post(`${ruta}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 100, montoAbonado: 40, medioPago: 'efectivo' })
      .expect(200);
    expect(entrega.body.saldoCliente).toBe(60);

    const cuenta = await api().get(`/api/cuentas/${clienteId}`).set(taller.auth).expect(200);
    expect(cuenta.body.saldos).toEqual([{ moneda: 'USD', saldo: 60 }]);

    // Un cobro en pesos no puede descontar una deuda en dólares.
    await api()
      .post(`/api/cuentas/${clienteId}/pagos`)
      .set(taller.auth)
      .send({ monto: 10, moneda: 'ARS', medioPago: 'efectivo' })
      .expect(409);
    const cobro = await api()
      .post(`/api/cuentas/${clienteId}/pagos`)
      .set(taller.auth)
      .send({ monto: 60, moneda: 'USD', medioPago: 'transferencia' })
      .expect(201);
    expect(cobro.body.saldo).toBe(0);

    const caja = await api().get('/api/reportes/caja').set(taller.auth).expect(200);
    expect(caja.body.totales).toEqual([
      expect.objectContaining({ moneda: 'USD', cobrado: 100, facturado: 100 })
    ]);

    // La nota interna queda en el historial pero no sale en el seguimiento público.
    const detalle = await api().get(ruta).set(taller.auth).expect(200);
    expect(
      detalle.body.historialEstados.some((h: { notaInterna: string }) => h.notaInterna === 'nota aprobado')
    ).toBe(true);
    const publico = await api().get(`/api/seguimiento/${detalle.body.codigoSeguimiento}`).expect(200);
    expect(JSON.stringify(publico.body)).not.toContain('nota aprobado');
  });

  /** Una orden lista para retirar, de un cliente con cuenta corriente. */
  async function ordenLista(taller: Sesion, datos: { moneda: string; presupuestoMonto: number }) {
    const orden = await crearOrden(taller, datos);
    await api()
      .put(`/api/clientes/${orden.clienteId}`)
      .set(taller.auth)
      .send({ cuentaCorrienteHabilitada: true })
      .expect(200);
    for (const estado of ['en_diagnostico', 'presupuestado', 'aprobado', 'listo_para_retirar']) {
      await api().put(`/api/ordenes/${orden.id}/estado`).set(taller.auth).send({ estado }).expect(200);
    }
    return orden;
  }

  it('una orden presupuestada en dólares se puede cobrar en pesos', async () => {
    const taller = await tallerConSucursal();
    const orden = await ordenLista(taller, { moneda: 'USD', presupuestoMonto: 100 });

    const entrega = await api()
      .post(`/api/ordenes/${orden.id}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 120000, montoAbonado: 100000, moneda: 'ARS', medioPago: 'efectivo' })
      .expect(200);
    expect(entrega.body).toMatchObject({ moneda: 'USD', monedaCobro: 'ARS', saldoCliente: 20000 });

    // La deuda y la caja quedan en la moneda en que se cobró.
    const cuenta = await api().get(`/api/cuentas/${orden.clienteId}`).set(taller.auth).expect(200);
    expect(cuenta.body.saldos).toEqual([{ moneda: 'ARS', saldo: 20000 }]);
    const caja = await api().get('/api/reportes/caja').set(taller.auth).expect(200);
    expect(caja.body.totales).toEqual([
      expect.objectContaining({ moneda: 'ARS', cobrado: 100000, facturado: 120000 })
    ]);

    // El presupuesto de lista no se pierde.
    const detalle = await api().get(`/api/ordenes/${orden.id}`).set(taller.auth).expect(200);
    expect(detalle.body.moneda).toBe('USD');
    expect(
      detalle.body.historialEstados.some((h: { comentario: string }) =>
        h.comentario?.includes('Presupuestado en USD 100.00')
      )
    ).toBe(true);
  });

  it('el saldo a favor en otra moneda no cubre el cobro', async () => {
    const taller = await tallerConSucursal();
    const orden = await ordenLista(taller, { moneda: 'USD', presupuestoMonto: 100 });
    await api()
      .post(`/api/cuentas/${orden.clienteId}/ajustes`)
      .set(taller.auth)
      .send({ monto: 50, moneda: 'USD', direccion: 'credito', motivo: 'Devolución' })
      .expect(201);

    const entrega = await api()
      .post(`/api/ordenes/${orden.id}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 1000, montoAbonado: 0, moneda: 'ARS' })
      .expect(200);
    expect(entrega.body).toMatchObject({ creditoAplicado: 0, pendiente: 1000, saldoCliente: 1000 });
  });

  it('una deuda en dólares se puede pagar en pesos', async () => {
    const taller = await tallerConSucursal();
    const orden = await ordenLista(taller, { moneda: 'USD', presupuestoMonto: 100 });
    await api()
      .post(`/api/ordenes/${orden.id}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 100, montoAbonado: 0 })
      .expect(200);

    const pagos = `/api/cuentas/${orden.clienteId}/pagos`;
    const pagoEnPesos = (monto: number, montoDeuda: number) => ({
      monto,
      moneda: 'ARS',
      monedaDeuda: 'USD',
      montoDeuda,
      medioPago: 'efectivo'
    });

    // No se puede cancelar más de lo que debe.
    await api().post(pagos).set(taller.auth).send(pagoEnPesos(132000, 110)).expect(409);

    const cobro = await api().post(pagos).set(taller.auth).send(pagoEnPesos(60000, 50)).expect(201);
    expect(cobro.body.saldo).toBe(50);

    // Baja la deuda en dólares y en pesos no queda nada.
    const cuenta = await api().get(`/api/cuentas/${orden.clienteId}`).set(taller.auth).expect(200);
    expect(cuenta.body.saldos).toEqual([{ moneda: 'USD', saldo: 50 }]);
    const notas = cuenta.body.movimientos.map((m: { nota: string }) => m.nota).join(' ');
    expect(notas).toContain('1 USD = 1200 ARS');

    // A la caja entraron pesos, y no dólares.
    const caja = await api().get('/api/reportes/caja').set(taller.auth).expect(200);
    const enMoneda = (moneda: string) =>
      caja.body.totales.find((t: { moneda: string }) => t.moneda === moneda);
    expect(enMoneda('ARS').cobrado).toBe(60000);
    expect(enMoneda('USD').cobrado).toBe(0);

    await api().post(pagos).set(taller.auth).send(pagoEnPesos(65000, 50)).expect(201);
    const alDia = await api().get(`/api/cuentas/${orden.clienteId}`).set(taller.auth).expect(200);
    expect(alDia.body.saldos).toEqual([]);
  });

  it('el detalle del presupuesto lo ve el cliente en el seguimiento', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller);

    const res = await api()
      .put(`/api/ordenes/${orden.id}/presupuesto`)
      .set(taller.auth)
      .send({ monto: 50000, detalle: 'Cambio de pantalla original, 90 días de garantía' })
      .expect(200);
    expect(res.body.estado).toBe('presupuestado');

    const detalle = await api().get(`/api/ordenes/${orden.id}`).set(taller.auth).expect(200);
    const publico = await api().get(`/api/seguimiento/${detalle.body.codigoSeguimiento}`).expect(200);
    expect(publico.body.presupuesto.detalle).toBe('Cambio de pantalla original, 90 días de garantía');
  });

  it('guarda los precios alternativos y los muestra en el seguimiento', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller, { moneda: 'USD', presupuestoMonto: 100 });
    const precios = [{ medioPago: 'efectivo', moneda: 'ARS', monto: 120000 }];

    await api()
      .put(`/api/ordenes/${orden.id}/presupuesto`)
      .set(taller.auth)
      .send({ monto: 100, moneda: 'USD', preciosAlternativos: precios })
      .expect(200);

    const detalle = await api().get(`/api/ordenes/${orden.id}`).set(taller.auth).expect(200);
    expect(detalle.body.precios).toEqual([
      expect.objectContaining({ medioPago: 'efectivo', moneda: 'ARS', monto: '120000.00' })
    ]);
    const publico = await api().get(`/api/seguimiento/${detalle.body.codigoSeguimiento}`).expect(200);
    expect(publico.body.presupuesto.alternativos).toEqual([
      { medioPago: 'efectivo', moneda: 'ARS', monto: '120000.00' }
    ]);

    // Una lista vacía los borra.
    await api()
      .put(`/api/ordenes/${orden.id}/presupuesto`)
      .set(taller.auth)
      .send({ preciosAlternativos: [] })
      .expect(200);
    const sinPrecios = await api().get(`/api/ordenes/${orden.id}`).set(taller.auth).expect(200);
    expect(sinPrecios.body.precios).toEqual([]);
  });
});

describe('datos fiscales', () => {
  it('cada taller guarda los suyos y guardar el nombre no los borra', async () => {
    const taller = await tallerConSucursal();

    await api()
      .put('/api/configuracion/taller')
      .set(taller.auth)
      .send({ fiscal: { cuit: '20-12345678-6', condicionIva: 'monotributo', puntoVenta: 3 } })
      .expect(200);
    await api().put('/api/configuracion/taller').set(taller.auth).send({ nombre: 'Otro nombre' }).expect(200);

    const me = await api().get('/api/auth/me').set(taller.auth).expect(200);
    expect(me.body.taller.fiscal).toMatchObject({
      cuit: '20123456786',
      condicionIva: 'monotributo',
      puntoVenta: 3
    });

    const otro = await tallerConSucursal();
    const meOtro = await api().get('/api/auth/me').set(otro.auth).expect(200);
    expect(meOtro.body.taller.fiscal.cuit).toBeNull();
  });

  it('rechaza un CUIT con el verificador equivocado', async () => {
    const taller = await tallerConSucursal();
    await api()
      .put('/api/configuracion/taller')
      .set(taller.auth)
      .send({ fiscal: { cuit: '20123456787' } })
      .expect(400);
  });

  it('un cliente sin condición cargada es consumidor final', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller);
    const cliente = await api().get(`/api/clientes/${orden.clienteId}`).set(taller.auth).expect(200);
    expect(cliente.body.condicionIva).toBe('consumidor_final');

    const editado = await api()
      .put(`/api/clientes/${orden.clienteId}`)
      .set(taller.auth)
      .send({ condicionIva: 'responsable_inscripto' })
      .expect(200);
    expect(editado.body.condicionIva).toBe('responsable_inscripto');
  });
});

describe('presupuesto y estados', () => {
  it('guardar un monto nuevo deja la orden presupuestada y sin respuesta del cliente', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller);
    const ruta = `/api/ordenes/${orden.id}`;

    const aprobada = await api()
      .put(`${ruta}/presupuesto`)
      .set(taller.auth)
      .send({ monto: 1000, aprobado: true })
      .expect(200);
    expect(aprobada.body).toMatchObject({ estado: 'aprobado', presupuestoAprobado: true });

    const nuevo = await api().put(`${ruta}/presupuesto`).set(taller.auth).send({ monto: 1500 }).expect(200);
    expect(nuevo.body).toMatchObject({ estado: 'presupuestado', presupuestoAprobado: null });
  });

  it('desde "aprobado" pasa a "no reparado" y se entrega', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller);
    const ruta = `/api/ordenes/${orden.id}`;
    await api().put(`${ruta}/presupuesto`).set(taller.auth).send({ monto: 1000, aprobado: true }).expect(200);
    await api().put(`${ruta}/estado`).set(taller.auth).send({ estado: 'no_reparado' }).expect(200);
    await api()
      .post(`${ruta}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 0, montoAbonado: 0, medioPago: 'efectivo' })
      .expect(200);
  });
});

describe('resumen del cliente', () => {
  it('cuenta las órdenes por cómo terminaron y trae el saldo', async () => {
    const taller = await tallerConSucursal();
    const reparada = await crearOrden(taller);
    const clienteId = reparada.clienteId;
    await api()
      .put(`/api/clientes/${clienteId}`)
      .set(taller.auth)
      .send({ cuentaCorrienteHabilitada: true })
      .expect(200);
    const ruta = `/api/ordenes/${reparada.id}`;
    await api().put(`${ruta}/presupuesto`).set(taller.auth).send({ monto: 1000, aprobado: true }).expect(200);
    await api().put(`${ruta}/estado`).set(taller.auth).send({ estado: 'listo_para_retirar' }).expect(200);
    await api()
      .post(`${ruta}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 1000, montoAbonado: 400, medioPago: 'efectivo' })
      .expect(200);

    const { body } = await api().get(`/api/clientes/${clienteId}/resumen`).set(taller.auth).expect(200);
    expect(body.cliente).toMatchObject({ id: clienteId, nombre: 'Juana' });
    expect(body.ordenes).toEqual({
      total: 1,
      enCurso: 0,
      reparadas: 1,
      noReparadas: 0,
      entregadas: 1,
      canceladas: 0
    });
    expect(body.cliente.saldos).toEqual([{ moneda: 'ARS', saldo: 600 }]);
    expect(body.listado).toEqual([
      expect.objectContaining({
        id: reparada.id,
        numeroOrden: reparada.numeroOrden,
        estado: 'entregado',
        grupo: 'entregadas',
        resultado: 'reparadas',
        equipo: expect.objectContaining({ marca: 'Motorola', modelo: 'G54' })
      })
    ]);

    const ajeno = await tallerConSucursal();
    await api().get(`/api/clientes/${clienteId}/resumen`).set(ajeno.auth).expect(404);
  });
});

describe('buscador de órdenes', () => {
  it('encuentra por número, serie, nombre completo, teléfono, DNI, modelo y color', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller);
    const otra = await crearOrden(taller, {
      cliente: { nombre: 'Carlos', apellido: 'Gómez', telefono: '999', dniCuit: '1' }
    });

    const buscar = async (texto: string) =>
      (await api().get('/api/ordenes').query({ search: texto }).set(taller.auth).expect(200)).body.map(
        (o: { id: number }) => o.id
      );

    expect(await buscar(orden.numeroOrden)).toEqual([orden.id]);
    expect(await buscar(orden.equipo.numeroSerie)).toEqual([orden.id]);
    expect(await buscar('Juana Pérez')).toEqual([orden.id]);
    expect(await buscar('Pérez Juana')).toEqual([orden.id]);
    expect(await buscar('555-1234')).toEqual([orden.id]);
    expect(await buscar('30111222')).toEqual([orden.id]);
    expect(await buscar('G54')).toEqual(expect.arrayContaining([orden.id, otra.id]));
    expect(await buscar('Azul')).toHaveLength(2);
    expect(await buscar('Gómez')).toEqual([otra.id]);
  });

  it('no ve órdenes de otro taller', async () => {
    const taller = await tallerConSucursal();
    const ajeno = await tallerConSucursal();
    const orden = await crearOrden(ajeno);
    const { body } = await api()
      .get('/api/ordenes')
      .query({ search: orden.numeroOrden })
      .set(taller.auth)
      .expect(200);
    expect(body.map((o: { id: number }) => o.id)).not.toContain(orden.id);
  });
});

describe('seguimiento público', () => {
  it('muestra el estado sin datos personales, y un código inventado da 404', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller, { presupuestoMonto: 25000 });
    const { body: detalle } = await api().get(`/api/ordenes/${orden.id}`).set(taller.auth).expect(200);

    const { body } = await api()
      .get(`/api/seguimiento/${detalle.codigoSeguimiento.toLowerCase()}`)
      .expect(200);
    expect(body).toMatchObject({
      numeroOrden: orden.numeroOrden,
      estado: 'recibido',
      nombreCliente: 'Juana',
      equipo: { marca: 'Motorola', modelo: 'G54' },
      presupuesto: { moneda: 'ARS' }
    });
    const texto = JSON.stringify(body);
    for (const privado of ['Pérez', '555-1234', '30111222', orden.equipo.numeroSerie]) {
      expect(texto).not.toContain(privado);
    }

    await api().get('/api/seguimiento/NOEXISTE22').expect(404);
  });
});

describe('tablero y reportes', () => {
  it('responden con los números de la sucursal', async () => {
    const taller = await tallerConSucursal();
    await crearOrden(taller);

    const tablero = await api().get('/api/reportes/tablero').set(taller.auth).expect(200);
    expect(tablero.body.hoy.ingresadas).toBe(1);
    expect(tablero.body.abiertasPorEstado).toEqual({ recibido: 1 });
    expect(tablero.body.primerosPasos).toMatchObject({ ordenes: 1, usuarios: 1 });

    const hoy = new Date().toISOString().slice(0, 10);
    const reportes = await api()
      .get('/api/reportes/resumen')
      .query({ desde: '2020-01-01', hasta: hoy })
      .set(taller.auth)
      .expect(200);
    expect(reportes.body.ordenes.ingresadas).toBe(1);
    expect(reportes.body.porUsuario[0]).toMatchObject({ recibidas: 1 });
    expect(reportes.body.abandonados.total).toBe(0);
  });

  it('listan las órdenes que ingresaron y las que se entregaron en el período', async () => {
    const taller = await tallerConSucursal();
    const entregada = await crearOrden(taller);
    const enCurso = await crearOrden(taller);
    for (const estado of ['en_diagnostico', 'presupuestado', 'aprobado', 'listo_para_retirar']) {
      await api().put(`/api/ordenes/${entregada.id}/estado`).set(taller.auth).send({ estado }).expect(200);
    }
    await api()
      .post(`/api/ordenes/${entregada.id}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 1000, montoAbonado: 1000, medioPago: 'efectivo' })
      .expect(200);

    const hoy = new Date().toISOString().slice(0, 10);
    const listar = (cuales: string) =>
      api().get('/api/reportes/ordenes').query({ cuales, desde: '2020-01-01', hasta: hoy }).set(taller.auth);

    const ingresadas = await listar('ingresadas').expect(200);
    expect(ingresadas.body.total).toBe(2);
    expect(ingresadas.body.ordenes.map((o: { id: number }) => o.id)).toEqual([enCurso.id, entregada.id]);
    const entregadas = await listar('entregadas').expect(200);
    expect(entregadas.body.total).toBe(1);
    expect(entregadas.body.ordenes[0]).toMatchObject({ id: entregada.id, estado: 'entregado' });
    expect(entregadas.body.ordenes[0].fechaEntrega).toBeTruthy();

    await listar('otras').expect(400);
    const tecnico = await tecnicoDe(taller);
    await api().get('/api/reportes/ordenes').query({ cuales: 'ingresadas' }).set(tecnico.auth).expect(403);
  });
});

describe('portal de clientes', () => {
  it('muestra datos, órdenes y cuenta solo con DNI completo y últimos 4 del teléfono', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller, { presupuestoMonto: 1000, cliente: { dniCuit: '30.111.222' } });
    await api()
      .put(`/api/clientes/${orden.clienteId}`)
      .set(taller.auth)
      .send({ cuentaCorrienteHabilitada: true })
      .expect(200);
    for (const estado of ['en_diagnostico', 'presupuestado', 'aprobado', 'listo_para_retirar']) {
      await api().put(`/api/ordenes/${orden.id}/estado`).set(taller.auth).send({ estado }).expect(200);
    }
    await api()
      .post(`/api/ordenes/${orden.id}/entrega`)
      .set(taller.auth)
      .send({ montoTotal: 1000, montoAbonado: 400, medioPago: 'tarjeta_credito' })
      .expect(200);

    const me = await api().get('/api/auth/me').set(taller.auth).expect(200);
    const codigo = me.body.taller.portalClientes.split('/cliente/')[1];
    const consultar = (dni: string, telefono: string, codigoTaller = codigo) =>
      api().post(`/api/portal/${codigoTaller}/consulta`).send({ dni, telefono });

    const { body } = await consultar('30111222', '1234').expect(200);
    expect(body.cliente).toMatchObject({ nombre: 'Juana', apellido: 'Pérez' });
    expect(body.ordenes).toHaveLength(1);
    expect(body.ordenes[0]).toMatchObject({ numeroOrden: orden.numeroOrden, estado: 'entregado' });
    expect(body.saldos).toEqual([{ moneda: 'ARS', saldo: 600 }]);
    expect(body.movimientos.map((m: { medioPago: string | null }) => m.medioPago)).toContain(
      'tarjeta_credito'
    );
    expect(JSON.stringify(body)).not.toMatch(/"nota"|notaInterna|claveDesbloqueo/);

    // Un dato equivocado y no se sabe cuál fue; otro taller no ve a este cliente.
    await consultar('30111222', '9999').expect(404);
    await consultar('30111223', '1234').expect(404);
    const otro = await tallerConSucursal();
    const meOtro = await api().get('/api/auth/me').set(otro.auth).expect(200);
    await consultar('30111222', '1234', meOtro.body.taller.portalClientes.split('/cliente/')[1]).expect(404);
    await consultar('123', '1234').expect(400);
  });
});

describe('búsqueda por número de serie', () => {
  it('encuentra solo la coincidencia exacta del taller', async () => {
    const taller = await tallerConSucursal();
    const orden = await crearOrden(taller);
    const serie = orden.equipo.numeroSerie;

    const exacta = await api().get('/api/equipos').query({ numeroSerie: serie }).set(taller.auth).expect(200);
    expect(exacta.body.map((e: { id: number }) => e.id)).toEqual([orden.equipoId]);
    const parcial = await api()
      .get('/api/equipos')
      .query({ numeroSerie: serie.slice(0, -1) })
      .set(taller.auth)
      .expect(200);
    expect(parcial.body).toHaveLength(0);
  });
});
