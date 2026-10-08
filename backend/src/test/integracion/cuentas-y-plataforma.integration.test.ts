import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  PASSWORD,
  api,
  capturarEmails,
  restaurarEmails,
  tallerConSucursal,
  unico,
  type Sesion
} from './helpers';

/** La administración de la plataforma es el email de PLATFORM_ADMIN_EMAILS de la config de tests. */
let plataforma: Sesion;

beforeAll(async () => {
  plataforma = await tallerConSucursal({ email: 'plataforma@test.local' });
});

afterEach(restaurarEmails);

describe('registro de un taller', () => {
  it('arranca en prueba, con la moneda de su país, y le avisa a la administración de la plataforma', async () => {
    const taller = await tallerConSucursal({ pais: 'UY' });

    const me = await api().get('/api/auth/me').set(taller.auth).expect(200);
    expect(me.body.taller).toMatchObject({ pais: 'UY', moneda: 'UYU' });
    expect(me.body.suscripcion).toMatchObject({ estado: 'prueba', bloqueada: false, avisar: true });
    expect(me.body.esAdminPlataforma).toBe(false);

    const avisos = await api().get('/api/notificaciones').set(plataforma.auth).expect(200);
    expect(
      avisos.body.some(
        (a: { tipo: string; link: string }) =>
          a.tipo === 'taller_nuevo' && a.link === `/plataforma?taller=${taller.tallerId}`
      )
    ).toBe(true);
  });

  it('un usuario agregado por el taller también se avisa, y la campanita cuenta y marca leídas', async () => {
    const taller = await tallerConSucursal();
    await api()
      .post('/api/usuarios')
      .set(taller.auth)
      .send({
        nombre: 'Téc',
        apellido: 'Nico',
        email: `tec-${unico()}@test.local`,
        password: PASSWORD,
        rol: 'tecnico'
      })
      .expect(201);

    const { body } = await api().get('/api/notificaciones/contador').set(plataforma.auth).expect(200);
    expect(body.noLeidas).toBeGreaterThanOrEqual(2);

    await api().post('/api/notificaciones/leer-todas').set(plataforma.auth).expect(204);
    const despues = await api().get('/api/notificaciones/contador').set(plataforma.auth).expect(200);
    expect(despues.body.noLeidas).toBe(0);
  });
});

describe('recuperar la contraseña', () => {
  it('sin email configurado avisa que no va a llegar nada', async () => {
    const { body } = await api().post('/api/auth/recuperar').send({ email: 'nadie@test.local' }).expect(200);
    expect(body.emailHabilitado).toBe(false);
  });

  it('con email configurado manda el link, cambia la contraseña y el link no sirve dos veces', async () => {
    const taller = await tallerConSucursal();
    const enviados = capturarEmails();

    await api().post('/api/auth/recuperar').send({ email: taller.email }).expect(200);
    const link = enviados.at(-1)!.html.match(/restablecer\?token=([\w-]+)/)!;
    expect(enviados.at(-1)!.to).toBe(taller.email);

    const nueva = 'NuevaClave99';
    await api()
      .post('/api/auth/restablecer')
      .send({ token: link[1], password: nueva, passwordConfirmacion: nueva })
      .expect(200);
    await api().post('/api/auth/login').send({ email: taller.email, password: nueva }).expect(200);
    await api().post('/api/auth/login').send({ email: taller.email, password: PASSWORD }).expect(401);
    await api()
      .post('/api/auth/restablecer')
      .send({ token: link[1], password: 'OtraClave77', passwordConfirmacion: 'OtraClave77' })
      .expect(400);
  });

  it('responde igual para un email que no existe (no revela cuentas)', async () => {
    const enviados = capturarEmails();
    await api()
      .post('/api/auth/recuperar')
      .send({ email: `no-existe-${unico()}@test.local` })
      .expect(200);
    expect(enviados).toHaveLength(0);
  });
});

describe('verificación de email', () => {
  it('el registro manda el link y al usarlo queda verificado', async () => {
    const enviados = capturarEmails();
    const taller = await tallerConSucursal();
    const link = enviados.find((e) => e.to === taller.email)!.html.match(/verificar-email\?token=([\w-]+)/)!;

    const { body } = await api().post('/api/auth/verificar-email').send({ token: link[1] }).expect(200);
    expect(body.email).toBe(taller.email);
  });
});

describe('suscripción vencida', () => {
  it('bloquea el login y las sesiones abiertas, con el contacto y los planes para reactivarla', async () => {
    const taller = await tallerConSucursal();

    await api()
      .put(`/api/plataforma/talleres/${taller.tallerId}/suscripcion`)
      .set(plataforma.auth)
      .send({ estado: 'cancelada' })
      .expect(200);

    const login = await api()
      .post('/api/auth/login')
      .send({ email: taller.email, password: PASSWORD })
      .expect(402);
    expect(login.body).toMatchObject({
      codigo: 'SUSCRIPCION_VENCIDA',
      contacto: { email: 'soporte@test.local', whatsapp: '5491100000000' }
    });
    expect(login.body.planes.length).toBeGreaterThan(0);
    expect(login.body.taller).toMatch(/^Taller /);

    const abierta = await api().get('/api/ordenes').set(taller.auth).expect(402);
    expect(abierta.body.codigo).toBe('SUSCRIPCION_VENCIDA');
  });

  it('una prueba con la fecha pasada bloquea sola, y reactivarla sin vencimiento devuelve el acceso', async () => {
    const taller = await tallerConSucursal();
    const ruta = `/api/plataforma/talleres/${taller.tallerId}/suscripcion`;

    await api().put(ruta).set(plataforma.auth).send({ estado: 'prueba', hasta: '2020-01-01' }).expect(200);
    await api().get('/api/auth/me').set(taller.auth).expect(402);

    const activa = await api()
      .put(ruta)
      .set(plataforma.auth)
      .send({ estado: 'activa', hasta: null })
      .expect(200);
    expect(activa.body).toMatchObject({ estado: 'activa', hasta: null, bloqueada: false });
    await api().get('/api/auth/me').set(taller.auth).expect(200);
  });

  it('la administración de la plataforma nunca queda afuera, aunque venza su propio taller', async () => {
    await api()
      .put(`/api/plataforma/talleres/${plataforma.tallerId}/suscripcion`)
      .set(plataforma.auth)
      .send({ estado: 'cancelada' })
      .expect(200);
    await api().post('/api/auth/login').send({ email: plataforma.email, password: PASSWORD }).expect(200);
    await api().get('/api/plataforma/resumen').set(plataforma.auth).expect(200);
  });
});

describe('consola de plataforma', () => {
  it('lista talleres y usuarios, y solo la ve quien administra la plataforma', async () => {
    const taller = await tallerConSucursal();

    const talleres = await api().get('/api/plataforma/talleres').set(plataforma.auth).expect(200);
    expect(talleres.body.length).toBeGreaterThan(1);
    const detalle = await api()
      .get(`/api/plataforma/talleres/${taller.tallerId}`)
      .set(plataforma.auth)
      .expect(200);
    expect(detalle.body.usuarios[0].email).toBe(taller.email);
    await api().get('/api/plataforma/usuarios?search=test.local').set(plataforma.auth).expect(200);

    await api().get('/api/plataforma/talleres').set(taller.auth).expect(403);
  });
});

describe('límites del plan', () => {
  async function conPlan(taller: Sesion, codigo: string) {
    const planes = await api().get('/api/plataforma/planes').set(plataforma.auth).expect(200);
    const plan = planes.body.find((p: { codigo: string }) => p.codigo === codigo);
    await api()
      .put(`/api/plataforma/talleres/${taller.tallerId}/suscripcion`)
      .set(plataforma.auth)
      .send({ estado: 'activa', planId: plan.id, hasta: null })
      .expect(200);
  }
  const nuevoUsuario = (taller: Sesion) =>
    api()
      .post('/api/usuarios')
      .set(taller.auth)
      .send({
        nombre: 'Téc',
        apellido: 'Nico',
        email: `tec-${unico()}@test.local`,
        password: PASSWORD,
        rol: 'tecnico'
      });

  it('en la prueba no hay límites', async () => {
    const taller = await tallerConSucursal();
    await api().post('/api/sucursales').set(taller.auth).send({ nombre: 'Segunda' }).expect(201);
    for (let i = 0; i < 3; i++) await nuevoUsuario(taller).expect(201);
  });

  it('el plan Taller permite 1 sucursal y 2 usuarios, y sugiere pasar al plan Cadena', async () => {
    const taller = await tallerConSucursal();
    await conPlan(taller, 'taller');

    const me = await api().get('/api/auth/me').set(taller.auth).expect(200);
    expect(me.body.usoDelPlan).toEqual({
      usuarios: { usados: 1, maximo: 2 },
      sucursales: { usados: 1, maximo: 1 }
    });

    const tecnico = await nuevoUsuario(taller).expect(201);
    const tercero = await nuevoUsuario(taller).expect(409);
    expect(tercero.body).toMatchObject({
      codigo: 'LIMITE_DEL_PLAN',
      recurso: 'usuarios',
      limite: 2,
      planSugerido: { nombre: 'Cadena' },
      contacto: { whatsapp: '5491100000000' }
    });

    const sucursal = await api()
      .post('/api/sucursales')
      .set(taller.auth)
      .send({ nombre: 'Segunda' })
      .expect(409);
    expect(sucursal.body.recurso).toBe('sucursales');

    // Dar de baja libera el lugar; reactivar con el plan lleno no se puede.
    await api().delete(`/api/usuarios/${tecnico.body.id}`).set(taller.auth).expect(204);
    const otro = await nuevoUsuario(taller).expect(201);
    expect(otro.body.id).toBeDefined();
    await api().put(`/api/usuarios/${tecnico.body.id}`).set(taller.auth).send({ activo: true }).expect(409);
  });

  it('el plan Cadena no limita usuarios', async () => {
    const taller = await tallerConSucursal();
    await conPlan(taller, 'cadena');
    for (let i = 0; i < 4; i++) await nuevoUsuario(taller).expect(201);
  });
});

describe('bajar a un plan más chico', () => {
  it('deja el taller excedido hasta que el admin elige qué queda activo', async () => {
    const taller = await tallerConSucursal();
    const segunda = await api()
      .post('/api/sucursales')
      .set(taller.auth)
      .send({ nombre: 'Segunda' })
      .expect(201);
    const tecnicos = [];
    for (let i = 0; i < 3; i++) {
      const t = await api()
        .post('/api/usuarios')
        .set(taller.auth)
        .send({
          nombre: 'Téc',
          apellido: `${i}`,
          email: `tec-${unico()}@test.local`,
          password: PASSWORD,
          rol: 'tecnico'
        })
        .expect(201);
      tecnicos.push(t.body.id);
    }

    // Pasa al plan Taller con 2 sucursales y 4 usuarios: la consola avisa el exceso.
    const planes = await api().get('/api/plataforma/planes').set(plataforma.auth).expect(200);
    const planTaller = planes.body.find((p: { codigo: string }) => p.codigo === 'taller');
    const cambio = await api()
      .put(`/api/plataforma/talleres/${taller.tallerId}/suscripcion`)
      .set(plataforma.auth)
      .send({ estado: 'activa', planId: planTaller.id, hasta: null })
      .expect(200);
    expect(cambio.body.exceso).toMatchObject({
      usuarios: { usados: 4, maximo: 2 },
      sucursales: { usados: 2, maximo: 1 }
    });

    // Mientras tanto, el taller no puede operar: solo ver el perfil y ajustar.
    const bloqueo = await api().get('/api/ordenes').set(taller.auth).expect(409);
    expect(bloqueo.body.codigo).toBe('PLAN_EXCEDIDO');
    const me = await api().get('/api/auth/me').set(taller.auth).expect(200);
    expect(me.body.excesoDelPlan.plan).toBe('Taller');

    const { body: detalle } = await api().get('/api/plan/exceso').set(taller.auth).expect(200);
    expect(detalle.usuarios).toHaveLength(4);
    const adminId = me.body.id;

    // No puede darse de baja a sí mismo ni quedarse con más de lo que permite el plan.
    await api()
      .post('/api/plan/ajustar')
      .set(taller.auth)
      .send({ usuarios: tecnicos.slice(0, 2), sucursales: [taller.sucursalId] })
      .expect(400);
    await api()
      .post('/api/plan/ajustar')
      .set(taller.auth)
      .send({ usuarios: [adminId, ...tecnicos], sucursales: [taller.sucursalId] })
      .expect(400);

    await api()
      .post('/api/plan/ajustar')
      .set(taller.auth)
      .send({ usuarios: [adminId, tecnicos[0]], sucursales: [taller.sucursalId] })
      .expect(204);

    const despues = await api().get('/api/auth/me').set(taller.auth).expect(200);
    expect(despues.body.excesoDelPlan).toBeNull();
    await api().get('/api/ordenes').set(taller.auth).expect(200);

    // Los que quedaron afuera no entran; la sucursal dada de baja no se puede elegir.
    const afuera = await api().get('/api/sucursales').set(taller.auth).expect(200);
    expect(afuera.body.find((s: { id: number }) => s.id === segunda.body.id).activo).toBe(false);
  });
});
