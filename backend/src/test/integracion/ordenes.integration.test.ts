import { describe, expect, it } from 'vitest';
import { api, crearOrden, tallerConSucursal } from './helpers';

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
    for (const estado of [
      'en_diagnostico',
      'presupuestado',
      'aprobado',
      'en_reparacion',
      'listo_para_retirar'
    ]) {
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
    for (const estado of [
      'en_diagnostico',
      'presupuestado',
      'aprobado',
      'en_reparacion',
      'listo_para_retirar'
    ]) {
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
