import request from 'supertest';
import { app } from '../../app';
import { setEmailProvider } from '../../integrations/email';
import type { EmailMessage } from '../../integrations/email/email.provider';

export const api = () => request(app);

let contador = 0;
/** Sufijo único por llamada: los tests comparten la base y no se pisan los emails. */
export const unico = () => `${Date.now().toString(36)}${(contador++).toString(36)}`;

export const PASSWORD = 'Clave1234';

export interface Sesion {
  token: string;
  email: string;
  tallerId: number;
  sucursalId: number;
  auth: { Authorization: string };
}

/** Registra un taller, crea su sucursal y devuelve una sesión ya con la sucursal elegida. */
export async function tallerConSucursal(opciones: { pais?: string; email?: string } = {}): Promise<Sesion> {
  const email = opciones.email ?? `dueno-${unico()}@test.local`;
  const registro = await api()
    .post('/api/auth/registro')
    .send({
      nombreTaller: `Taller ${unico()}`,
      pais: opciones.pais,
      nombre: 'Dueño',
      apellido: 'Prueba',
      email,
      password: PASSWORD,
      passwordConfirmacion: PASSWORD
    })
    .expect(201);

  const auth = { Authorization: `Bearer ${registro.body.token}` };
  const sucursal = await api().post('/api/sucursales').set(auth).send({ nombre: 'Central' }).expect(201);
  const conSucursal = await api()
    .post('/api/auth/seleccionar-sucursal')
    .set(auth)
    .send({ sucursalId: sucursal.body.id })
    .expect(200);
  const me = await api().get('/api/auth/me').set(auth).expect(200);

  return {
    token: conSucursal.body.token,
    email,
    tallerId: me.body.taller.id,
    sucursalId: sucursal.body.id,
    auth: { Authorization: `Bearer ${conSucursal.body.token}` }
  };
}

/** Crea un tipo de equipo y una orden con cliente y equipo nuevos. */
export async function crearOrden(
  sesion: Sesion,
  datos: { moneda?: string; presupuestoMonto?: number; cliente?: Record<string, unknown> } = {}
) {
  const tipo = await api()
    .post('/api/configuracion/tipos-equipo')
    .set(sesion.auth)
    .send({ nombre: `Celular ${unico()}` })
    .expect(201);
  const respuesta = await api()
    .post('/api/ordenes')
    .set(sesion.auth)
    .send({
      nuevoCliente: {
        nombre: 'Juana',
        apellido: 'Pérez',
        telefono: '221 555-1234',
        dniCuit: '30111222',
        ...datos.cliente
      },
      nuevoEquipo: {
        tipoEquipoPersonalizadoId: tipo.body.id,
        marca: 'Motorola',
        modelo: 'G54',
        color: 'Azul',
        numeroSerie: `SN-${unico()}`
      },
      reparacionSolicitada: 'Cambio de pantalla',
      presupuestoMonto: datos.presupuestoMonto,
      moneda: datos.moneda
    })
    .expect(201);
  return respuesta.body;
}

/** Proveedor de email que guarda los mensajes en vez de mandarlos. */
export function capturarEmails(): EmailMessage[] {
  const enviados: EmailMessage[] = [];
  setEmailProvider({
    estaConfigurado: () => true,
    send: async (mensaje) => {
      enviados.push(mensaje);
    }
  });
  return enviados;
}

export const restaurarEmails = () => setEmailProvider(null);
