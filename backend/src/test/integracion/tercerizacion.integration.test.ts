import { describe, expect, it } from 'vitest';
import { api, crearOrden, tallerConSucursal, type Sesion } from './helpers';

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Un CUIT válido y al azar: los tests comparten la base y no pueden chocar con talleres de otra corrida. */
function cuitAlAzar(): string {
  for (;;) {
    const base = `30${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const suma = PESOS_CUIT.reduce((total, peso, i) => total + peso * Number(base[i]), 0);
    const resto = 11 - (suma % 11);
    const verificador = resto === 11 ? 0 : resto;
    if (verificador !== 10) return `${base}${verificador}`;
  }
}

async function conCuit(taller: Sesion): Promise<string> {
  const cuit = cuitAlAzar();
  await api()
    .put('/api/configuracion/taller')
    .set(taller.auth)
    .send({ fiscal: { cuit, razonSocial: 'Destino SRL' } })
    .expect(200);
  return cuit;
}

const estado = (sesion: Sesion, ordenId: number, nuevo: string) =>
  api().put(`/api/ordenes/${ordenId}/estado`).set(sesion.auth).send({ estado: nuevo });

describe('tercerizar a un taller que usa RepairOS', () => {
  it('le arma la orden al destino, le avisa, y el cliente sigue viendo "en reparación"', async () => {
    const origen = await tallerConSucursal();
    const destino = await tallerConSucursal();
    const cuit = await conCuit(destino);
    // El destino tiene sus propios tipos, con otros nombres, y su checklist.
    const tipoDestino = await api()
      .post('/api/configuracion/tipos-equipo')
      .set(destino.auth)
      .send({ nombre: 'Smartphone' })
      .expect(201);
    await api()
      .post(`/api/configuracion/tipos-equipo/${tipoDestino.body.id}/chequeos`)
      .set(destino.auth)
      .send({ chequeos: [{ texto: 'Face ID' }, { texto: 'Cámara trasera' }] });
    const orden = await crearOrden(origen, { cliente: { nombre: 'Juana', apellido: 'Secreta' } });
    await estado(origen, orden.id, 'en_reparacion').expect(200);

    // Autocompletar por CUIT (con guiones) devuelve el taller y sus sucursales.
    const busqueda = await api()
      .get('/api/ordenes/tercerizacion/destino')
      .query({ dniCuit: `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` })
      .set(origen.auth)
      .expect(200);
    expect(busqueda.body.taller).toMatchObject({ id: destino.tallerId, cuit });
    expect(busqueda.body.taller.sucursales[0].id).toBe(destino.sucursalId);

    const enviada = await api()
      .post(`/api/ordenes/${orden.id}/tercerizar`)
      .set(origen.auth)
      .send({
        nombre: busqueda.body.taller.nombre,
        dniCuit: cuit,
        trabajo: 'Cambio de módulo',
        tallerDestinoId: destino.tallerId,
        notaInterna: 'Le pasamos el precio de lista'
      })
      .expect(200);
    expect(enviada.body.estado).toBe('externo');
    // De "en reparación" a "externo" el cliente no ve ningún cambio: no se le avisa.
    expect(enviada.body.notificacion).toBeNull();

    // El cliente no se entera.
    const publico = await api().get(`/api/seguimiento/${orden.codigoSeguimiento}`).expect(200);
    expect(publico.body.estado).toBe('en_reparacion');
    expect(JSON.stringify(publico.body)).not.toMatch(/externo|Destino SRL|Cambio de módulo/i);

    // El destino tiene la orden "por recibir", con el taller de origen como cliente.
    const detalleOrigen = await api().get(`/api/ordenes/${orden.id}`).set(origen.auth).expect(200);
    const [envio] = detalleOrigen.body.tercerizaciones;
    expect(envio).toMatchObject({ estado: 'enviada', enRepairOS: true });
    expect(envio.ordenDestino.estado).toBe('por_recibir');

    const ordenesDestino = await api()
      .get('/api/ordenes')
      .query({ estado: 'por_recibir' })
      .set(destino.auth)
      .expect(200);
    expect(ordenesDestino.body).toHaveLength(1);
    const ordenDestinoId = ordenesDestino.body[0].id;
    const detalleDestino = await api().get(`/api/ordenes/${ordenDestinoId}`).set(destino.auth).expect(200);
    expect(detalleDestino.body.reparacionSolicitada).toBe('Cambio de módulo');
    expect(detalleDestino.body.cliente.esGremio).toBe(true);
    // No se le crean tipos: el equipo queda con uno suyo hasta que elija al recibir.
    expect(detalleDestino.body.equipo.tipoEquipo.nombre).toBe('Smartphone');
    const tipos = await api().get('/api/configuracion/tipos-equipo').set(destino.auth).expect(200);
    expect(tipos.body).toHaveLength(1);
    // El estado estético lo registra el destino, con su criterio.
    expect(detalleDestino.body.detallesEsteticos).toBeNull();
    expect(detalleDestino.body.tercerizacionRecibida.numeroOrden).toBe(orden.numeroOrden);
    // Los datos del cliente final no salen del taller de origen.
    expect(JSON.stringify(detalleDestino.body)).not.toMatch(/Juana|Secreta|30111222|precio de lista/);

    const avisos = await api().get('/api/notificaciones').set(destino.auth).expect(200);
    expect(avisos.body.some((n: { tipo: string }) => n.tipo === 'tercerizacion')).toBe(true);

    // Llega el equipo: el destino lo recibe y el origen se entera.
    await api()
      .post(`/api/ordenes/${ordenDestinoId}/recepcion`)
      .set(destino.auth)
      .send({ tipoEquipoPersonalizadoId: tipoDestino.body.id })
      .expect(200);
    // El chequeo es el checklist del destino, sin responder.
    const recibidoDestino = await api().get(`/api/ordenes/${ordenDestinoId}`).set(destino.auth).expect(200);
    expect(recibidoDestino.body.estado).toBe('recibido');
    expect(recibidoDestino.body.chequeos.map((c: { item: string }) => c.item)).toEqual([
      'Face ID',
      'Cámara trasera'
    ]);
    expect(
      recibidoDestino.body.chequeos.every((c: { resultado: string | null }) => c.resultado === null)
    ).toBe(true);
    const recibido = await api().get(`/api/ordenes/${orden.id}`).set(origen.auth).expect(200);
    expect(recibido.body.tercerizaciones[0]).toMatchObject({ estado: 'recibida' });
    expect(recibido.body.tercerizaciones[0].ordenDestino.estado).toBe('recibido');
    const avisosOrigen = await api().get('/api/notificaciones').set(origen.auth).expect(200);
    expect(avisosOrigen.body[0].titulo).toContain('recibió el equipo');

    // Vuelve: al pasar a "listo", el envío queda cerrado.
    await estado(origen, orden.id, 'listo_para_retirar').expect(200);
    const final = await api().get(`/api/ordenes/${orden.id}`).set(origen.auth).expect(200);
    expect(final.body.tercerizaciones[0].estado).toBe('devuelta');
  });

  it('si el origen se arrepiente antes de que llegue, la orden del destino se cancela', async () => {
    const origen = await tallerConSucursal();
    const destino = await tallerConSucursal();
    const cuit = await conCuit(destino);
    const orden = await crearOrden(origen);

    await api()
      .post(`/api/ordenes/${orden.id}/tercerizar`)
      .set(origen.auth)
      .send({ nombre: 'Destino', dniCuit: cuit, trabajo: 'Revisar placa', tallerDestinoId: destino.tallerId })
      .expect(200);
    await estado(origen, orden.id, 'en_reparacion').expect(200);

    const ordenes = await api().get('/api/ordenes').set(destino.auth).expect(200);
    expect(ordenes.body[0].estado).toBe('cancelado');
    const detalle = await api().get(`/api/ordenes/${orden.id}`).set(origen.auth).expect(200);
    expect(detalle.body.tercerizaciones[0].estado).toBe('cancelada');
  });

  it('no deja mandarle órdenes a un taller con solo conocer su id', async () => {
    const origen = await tallerConSucursal();
    const destino = await tallerConSucursal();
    await conCuit(destino);
    const orden = await crearOrden(origen);

    await api()
      .post(`/api/ordenes/${orden.id}/tercerizar`)
      .set(origen.auth)
      .send({ nombre: 'X', dniCuit: cuitAlAzar(), trabajo: 'Algo', tallerDestinoId: destino.tallerId })
      .expect(400);
  });
});

describe('tercerizar a alguien de afuera', () => {
  it('queda anotado, se autocompleta la próxima vez y se puede volver a "externo"', async () => {
    const origen = await tallerConSucursal();
    const orden = await crearOrden(origen);

    // A "externo" no se llega con un cambio de estado común: falta a quién.
    await estado(origen, orden.id, 'externo').expect(409);

    const datos = {
      nombre: 'Microsoldadura Pérez',
      dniCuit: '25.123.456',
      direccion: 'Calle 7 Nº 123',
      telefono: '221 444-5555',
      email: 'perez@test.local',
      trabajo: 'Reballing de CPU'
    };
    await api().post(`/api/ordenes/${orden.id}/tercerizar`).set(origen.auth).send(datos).expect(200);

    const busqueda = await api()
      .get('/api/ordenes/tercerizacion/destino')
      .query({ dniCuit: '25123456' })
      .set(origen.auth)
      .expect(200);
    expect(busqueda.body.taller).toBeNull();
    expect(busqueda.body.anterior).toMatchObject({ nombre: datos.nombre, dniCuit: '25123456' });

    // El externo cotiza: se presupuesta y el equipo sigue allá.
    await api().put(`/api/ordenes/${orden.id}/presupuesto`).set(origen.auth).send({ monto: 900 }).expect(200);
    await api()
      .put(`/api/ordenes/${orden.id}/presupuesto`)
      .set(origen.auth)
      .send({ aprobado: true })
      .expect(200);
    let detalle = await api().get(`/api/ordenes/${orden.id}`).set(origen.auth).expect(200);
    expect(detalle.body.tercerizaciones[0].estado).toBe('enviada');

    // Aprobado, vuelve a "externo" sin cargar todo de nuevo.
    await estado(origen, orden.id, 'externo').expect(200);
    await estado(origen, orden.id, 'listo_para_retirar').expect(200);
    detalle = await api().get(`/api/ordenes/${orden.id}`).set(origen.auth).expect(200);
    expect(detalle.body.tercerizaciones[0].estado).toBe('devuelta');
  });
});
