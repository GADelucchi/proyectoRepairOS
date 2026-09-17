import { Transaction } from 'sequelize';
import { sequelize, Solicitud, User, Cliente } from '../models';
import { DatosAjuste, DatosFiado } from '../models/Solicitud';
import { HttpError } from '../middlewares/errorHandler';
import { getEmailProvider } from './email';
import { registrarAjuste, saldoDeCliente } from './cuentaCorriente';

/** Datos de quien pide la autorización, comunes a los dos tipos. */
export interface ContextoSolicitud {
  tallerId: number;
  solicitanteId: number;
  esAdmin: boolean;
  sucursalId?: number | null;
}

/**
 * Avisa a los admins del taller que hay algo esperando aprobación.
 *
 * Es best-effort a propósito: la solicitud ya quedó registrada y visible en la
 * pantalla de autorizaciones, así que un correo que no sale no puede tumbar la
 * operación del mostrador.
 */
async function avisarAAdmins(solicitud: Solicitud, cliente: Cliente, detalle: string): Promise<void> {
  const proveedor = getEmailProvider();
  if (!proveedor.estaConfigurado()) return;

  const admins = await User.findAll({
    where: { tallerId: solicitud.tallerId, rol: 'admin', activo: true },
    attributes: ['email']
  });

  const asunto =
    solicitud.tipo === 'fiado'
      ? 'Piden autorización para entregar un equipo fiado'
      : 'Piden autorización para ajustar una cuenta corriente';

  await Promise.all(
    admins
      .filter((admin) => admin.email)
      .map((admin) =>
        proveedor
          .send({
            to: admin.email,
            subject: asunto,
            html: `<p>${detalle}</p><p>Cliente: ${cliente.nombre} ${cliente.apellido}</p><p>Motivo: ${solicitud.motivo}</p><p>Entrá a RepairOS, sección Autorizaciones, para aprobarla o rechazarla.</p>`
          })
          .catch(() => undefined)
      )
  );
}

/** Corta si el cliente ya tiene un pedido de fiado esperando para esa orden. */
async function exigirSinPendienteParaOrden(tallerId: number, ordenId: number): Promise<void> {
  const pendiente = await Solicitud.findOne({
    where: { tallerId, ordenId, tipo: 'fiado', estado: 'pendiente' }
  });
  if (pendiente) {
    throw new HttpError(409, 'Ya hay un pedido de autorización pendiente para esta orden');
  }
}

interface CrearFiadoInput extends ContextoSolicitud {
  cliente: Cliente;
  ordenId: number;
  pendiente: number;
  motivo: string;
  datos: DatosFiado;
}

/** Pide autorización para entregar un equipo dejando saldo en cuenta corriente. */
export async function crearSolicitudFiado(input: CrearFiadoInput): Promise<Solicitud> {
  await exigirSinPendienteParaOrden(input.tallerId, input.ordenId);

  const solicitud = await Solicitud.create({
    tallerId: input.tallerId,
    tipo: 'fiado',
    clienteId: input.cliente.id,
    ordenId: input.ordenId,
    sucursalId: input.sucursalId ?? null,
    solicitanteId: input.solicitanteId,
    monto: input.pendiente.toFixed(2),
    datos: input.datos,
    motivo: input.motivo
  });

  await avisarAAdmins(
    solicitud,
    input.cliente,
    `Piden entregar un equipo dejando ${input.pendiente.toFixed(2)} en cuenta corriente.`
  );

  return solicitud;
}

interface CrearAjusteInput extends ContextoSolicitud {
  cliente: Cliente;
  monto: number;
  direccion: 'debito' | 'credito';
  motivo: string;
}

/** Pide autorización para corregir el saldo de una cuenta corriente. */
export async function crearSolicitudAjuste(input: CrearAjusteInput): Promise<Solicitud> {
  const solicitud = await Solicitud.create({
    tallerId: input.tallerId,
    tipo: 'ajuste',
    clienteId: input.cliente.id,
    sucursalId: input.sucursalId ?? null,
    solicitanteId: input.solicitanteId,
    monto: input.monto.toFixed(2),
    datos: { direccion: input.direccion } satisfies DatosAjuste,
    motivo: input.motivo
  });

  await avisarAAdmins(
    solicitud,
    input.cliente,
    `Piden ${input.direccion === 'debito' ? 'sumar' : 'descontar'} ${input.monto.toFixed(2)} en la cuenta del cliente.`
  );

  return solicitud;
}

/**
 * Ejecuta lo que la solicitud pedía. Recibe la transacción de quien aprueba.
 *
 * El fiado no se resuelve acá: la entrega es del controlador de órdenes, que
 * sabe mover el estado y armar el historial. Este módulo solo aplica el ajuste,
 * que es un movimiento y nada más.
 */
export async function aplicarAjusteAprobado(
  solicitud: Solicitud,
  aprobadorId: number,
  transaction: Transaction
): Promise<void> {
  const datos = solicitud.datos as DatosAjuste | null;
  if (!datos?.direccion) {
    throw new HttpError(500, 'La solicitud de ajuste no tiene dirección registrada');
  }

  await registrarAjuste(datos.direccion, {
    tallerId: solicitud.tallerId,
    clienteId: solicitud.clienteId,
    usuarioId: aprobadorId,
    sucursalId: solicitud.sucursalId,
    monto: Number(solicitud.monto),
    nota: `Ajuste autorizado — ${solicitud.motivo}`,
    transaction
  });
}

/** Marca la solicitud como resuelta. No ejecuta nada: eso va antes. */
export async function cerrarSolicitud(
  solicitud: Solicitud,
  estado: 'aprobada' | 'rechazada' | 'cancelada',
  usuarioId: number,
  respuesta?: string | null,
  transaction?: Transaction
): Promise<void> {
  await solicitud.update(
    {
      estado,
      resueltoPorId: usuarioId,
      resueltoEn: new Date(),
      respuesta: respuesta?.trim() || null
    },
    { transaction }
  );
}

/**
 * Aprueba un ajuste y devuelve el saldo que le queda al cliente.
 *
 * Va en una transacción porque el movimiento y el cierre de la solicitud tienen
 * que quedar juntos: un ajuste aplicado con la solicitud todavía pendiente se
 * volvería a aprobar y descontaría dos veces.
 */
export async function aprobarAjuste(
  solicitud: Solicitud,
  aprobadorId: number,
  respuesta?: string | null
): Promise<number> {
  await sequelize.transaction(async (t) => {
    await aplicarAjusteAprobado(solicitud, aprobadorId, t);
    await cerrarSolicitud(solicitud, 'aprobada', aprobadorId, respuesta, t);
  });

  return saldoDeCliente(solicitud.tallerId, solicitud.clienteId);
}
