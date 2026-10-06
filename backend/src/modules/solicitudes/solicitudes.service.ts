import { Transaction } from 'sequelize';
import { sequelize, Cliente, Solicitud } from '../../models';
import { DatosAjuste, DatosFiado, EstadoSolicitud } from '../../models/Solicitud';
import { errores } from '../../shared/http/http-error';
import { Moneda, montoConMoneda } from '../../shared/utils/dinero';
import { nombreCompleto } from '../../shared/utils/texto';
import { avisarAdmins } from '../notificaciones/notificaciones.service';
import { bloquearCliente, registrarAjuste, saldoDeCliente } from '../cuentas/cuenta-corriente.service';
import { ejecutarEntrega, ResultadoEntrega } from '../ordenes/entrega.service';

/**
 * Pedidos de autorización a un supervisor: fiar una entrega o ajustar un saldo.
 *
 * Son decisiones que el mostrador no puede tomar solo. En vez de frenarlas, se
 * piden con un motivo y un admin las aprueba o las rechaza. Cuando quien pide
 * ya es admin se ejecutan en el acto, pero la solicitud queda igual asentada:
 * es el registro de quién autorizó.
 */

const RESPUESTA_AUTOAPROBADA = 'Autorizada por quien la pidió (admin)';

interface ContextoPedido {
  tallerId: number;
  solicitanteId: number;
  sucursalId: number | null;
  cliente: Cliente;
  motivo: string;
  /** Moneda de la deuda o del ajuste: la de la orden, en un fiado. */
  moneda: Moneda;
}

interface PedidoFiado extends ContextoPedido {
  ordenId: number;
  pendiente: number;
  datos: DatosFiado;
}

interface PedidoAjuste extends ContextoPedido {
  monto: number;
  direccion: 'debito' | 'credito';
}

/** Marca la solicitud como resuelta. No ejecuta nada: eso va antes. */
async function cerrarSolicitud(
  solicitud: Solicitud,
  estado: Exclude<EstadoSolicitud, 'pendiente'>,
  usuarioId: number,
  respuesta?: string | null,
  transaction?: Transaction
): Promise<void> {
  await solicitud.update(
    { estado, resueltoPorId: usuarioId, resueltoEn: new Date(), respuesta: respuesta?.trim() || null },
    { transaction }
  );
}

/**
 * Relee la solicitud con la fila bloqueada y corta si ya no está pendiente.
 * Así dos admins que aprueban a la vez no ejecutan el pedido dos veces.
 */
async function bloquearPendiente(id: number, transaction: Transaction): Promise<Solicitud> {
  const solicitud = await Solicitud.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!solicitud) throw errores.noEncontrado('Solicitud');
  if (solicitud.estado !== 'pendiente') throw errores.conflicto(`La solicitud ya está ${solicitud.estado}`);
  return solicitud;
}

function datosDeSolicitud(pedido: ContextoPedido) {
  return {
    tallerId: pedido.tallerId,
    clienteId: pedido.cliente.id,
    sucursalId: pedido.sucursalId,
    solicitanteId: pedido.solicitanteId,
    moneda: pedido.moneda,
    motivo: pedido.motivo
  };
}

// ---------------------------------------------------------------------------
// Fiado
// ---------------------------------------------------------------------------

/** Pide autorización para entregar un equipo dejando saldo en cuenta corriente. */
export async function pedirFiado(pedido: PedidoFiado): Promise<Solicitud> {
  const yaPendiente = await Solicitud.count({
    where: { tallerId: pedido.tallerId, ordenId: pedido.ordenId, tipo: 'fiado', estado: 'pendiente' }
  });
  if (yaPendiente) throw errores.conflicto('Ya hay un pedido de autorización pendiente para esta orden');

  const solicitud = await Solicitud.create({
    ...datosDeSolicitud(pedido),
    tipo: 'fiado',
    ordenId: pedido.ordenId,
    monto: pedido.pendiente.toFixed(2),
    datos: pedido.datos
  });

  await avisarAdmins(pedido.tallerId, 'Piden autorización para entregar un equipo fiado', [
    `Piden entregar un equipo dejando ${montoConMoneda(pedido.pendiente, pedido.moneda)} en cuenta corriente.`,
    `Cliente: ${nombreCompleto(pedido.cliente)}`,
    `Motivo: ${pedido.motivo}`
  ]);
  return solicitud;
}

/**
 * Un admin fía en el acto: entrega y deja la solicitud aprobada, las dos cosas
 * en la misma transacción.
 */
export async function fiarComoAdmin(
  pedido: PedidoFiado,
  autorizadoPor: string
): Promise<{ solicitud: Solicitud; entrega: ResultadoEntrega }> {
  let solicitud: Solicitud | undefined;

  const entrega = await ejecutarEntrega({
    ordenId: pedido.ordenId,
    tallerId: pedido.tallerId,
    usuarioId: pedido.solicitanteId,
    sucursalId: pedido.sucursalId,
    montoTotal: pedido.datos.montoTotal,
    montoAbonado: pedido.datos.montoAbonado,
    medioPago: pedido.datos.medioPago,
    monedaEsperada: pedido.moneda,
    puedeForzar: false,
    autorizadoPor,
    enLaMismaTransaccion: async (transaction) => {
      solicitud = await Solicitud.create(
        {
          ...datosDeSolicitud(pedido),
          tipo: 'fiado',
          ordenId: pedido.ordenId,
          monto: pedido.pendiente.toFixed(2),
          datos: pedido.datos,
          estado: 'aprobada',
          resueltoPorId: pedido.solicitanteId,
          resueltoEn: new Date(),
          respuesta: RESPUESTA_AUTOAPROBADA
        },
        { transaction }
      );
    }
  });

  return { solicitud: solicitud!, entrega };
}

/**
 * Aprueba un fiado: entrega el equipo en nombre de quien lo pidió (es quien lo
 * tiene en el mostrador y recibe la plata) y cierra la solicitud, todo junto.
 */
async function aprobarFiado(
  solicitud: Solicitud,
  aprobadorId: number,
  aprobadorNombre: string,
  respuesta?: string | null
): Promise<void> {
  const datos = solicitud.datos as DatosFiado | null;
  if (!datos || !solicitud.ordenId) throw new Error(`La solicitud de fiado ${solicitud.id} está incompleta`);

  await ejecutarEntrega({
    ordenId: solicitud.ordenId,
    tallerId: solicitud.tallerId,
    usuarioId: solicitud.solicitanteId,
    sucursalId: solicitud.sucursalId,
    montoTotal: datos.montoTotal,
    montoAbonado: datos.montoAbonado,
    medioPago: datos.medioPago,
    monedaEsperada: solicitud.moneda,
    puedeForzar: false,
    autorizadoPor: aprobadorNombre,
    enLaMismaTransaccion: async (transaction) => {
      const bloqueada = await bloquearPendiente(solicitud.id, transaction);
      await cerrarSolicitud(bloqueada, 'aprobada', aprobadorId, respuesta, transaction);
    }
  });
}

// ---------------------------------------------------------------------------
// Ajuste de saldo
// ---------------------------------------------------------------------------

function aplicarAjuste(solicitud: Solicitud, aprobadorId: number, transaction: Transaction) {
  const { direccion } = solicitud.datos as DatosAjuste;
  return registrarAjuste(direccion, {
    tallerId: solicitud.tallerId,
    clienteId: solicitud.clienteId,
    usuarioId: aprobadorId,
    sucursalId: solicitud.sucursalId,
    monto: Number(solicitud.monto),
    moneda: solicitud.moneda,
    nota: `Ajuste autorizado — ${solicitud.motivo}`,
    transaction
  });
}

/** Pide (o, si es admin, aplica) un ajuste. Devuelve el saldo si se aplicó. */
export async function pedirAjuste(
  pedido: PedidoAjuste,
  esAdmin: boolean
): Promise<{ solicitud: Solicitud; saldo?: number }> {
  const base = {
    ...datosDeSolicitud(pedido),
    tipo: 'ajuste' as const,
    monto: pedido.monto.toFixed(2),
    datos: { direccion: pedido.direccion } satisfies DatosAjuste
  };

  if (!esAdmin) {
    const solicitud = await Solicitud.create(base);
    const accion = pedido.direccion === 'debito' ? 'sumar' : 'descontar';
    await avisarAdmins(pedido.tallerId, 'Piden autorización para ajustar una cuenta corriente', [
      `Piden ${accion} ${montoConMoneda(pedido.monto, pedido.moneda)} en la cuenta del cliente.`,
      `Cliente: ${nombreCompleto(pedido.cliente)}`,
      `Motivo: ${pedido.motivo}`
    ]);
    return { solicitud };
  }

  const solicitud = await sequelize.transaction(async (transaction) => {
    await bloquearCliente(pedido.cliente.id, transaction);
    const creada = await Solicitud.create(
      {
        ...base,
        estado: 'aprobada',
        resueltoPorId: pedido.solicitanteId,
        resueltoEn: new Date(),
        respuesta: RESPUESTA_AUTOAPROBADA
      },
      { transaction }
    );
    await aplicarAjuste(creada, pedido.solicitanteId, transaction);
    return creada;
  });

  return { solicitud, saldo: await saldoDeCliente(pedido.tallerId, pedido.cliente.id, pedido.moneda) };
}

// ---------------------------------------------------------------------------
// Resolución
// ---------------------------------------------------------------------------

/**
 * Aprueba la solicitud y ejecuta lo que pedía, en la misma operación: aprobar
 * sin ejecutar dejaría al mostrador esperando un segundo paso que nadie le avisa.
 * Devuelve el saldo del cliente en la moneda de la solicitud.
 */
export async function aprobar(
  solicitud: Solicitud,
  aprobador: { id: number; nombre: string },
  respuesta?: string | null
): Promise<number> {
  if (solicitud.estado !== 'pendiente') throw errores.conflicto(`La solicitud ya está ${solicitud.estado}`);

  if (solicitud.tipo === 'fiado') {
    await aprobarFiado(solicitud, aprobador.id, aprobador.nombre, respuesta);
  } else {
    await sequelize.transaction(async (transaction) => {
      const bloqueada = await bloquearPendiente(solicitud.id, transaction);
      await bloquearCliente(bloqueada.clienteId, transaction);
      await aplicarAjuste(bloqueada, aprobador.id, transaction);
      await cerrarSolicitud(bloqueada, 'aprobada', aprobador.id, respuesta, transaction);
    });
  }

  return saldoDeCliente(solicitud.tallerId, solicitud.clienteId, solicitud.moneda);
}

export async function rechazarOCancelar(
  solicitud: Solicitud,
  estado: 'rechazada' | 'cancelada',
  usuarioId: number,
  respuesta?: string | null
): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const bloqueada = await bloquearPendiente(solicitud.id, transaction);
    await cerrarSolicitud(bloqueada, estado, usuarioId, respuesta, transaction);
  });
}
