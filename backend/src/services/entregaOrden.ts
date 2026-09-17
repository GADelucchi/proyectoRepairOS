import { Transaction } from 'sequelize';
import { sequelize, Cliente, Orden, OrdenHistorialEstado } from '../models';
import { MedioPago } from '../models/CuentaMovimiento';
import { esTransicionValida } from '../models/estadoOrden';
import { HttpError } from '../middlewares/errorHandler';
import { etiquetaEstado, notificarCambioEstadoOrden, ResultadoNotificacion } from './notificationService';
import {
  exigirCuentaCorriente,
  redondearMonto,
  registrarCargo,
  registrarPago,
  repartirEntrega,
  saldoDeCliente
} from './cuentaCorriente';

export interface EntregaInput {
  orden: Orden;
  cliente: Cliente;
  tallerId: number;
  /** Quien recibe la plata y queda como responsable de la entrega. */
  usuarioId: number;
  sucursalId: number;
  montoTotal: number;
  montoAbonado: number;
  medioPago?: MedioPago | null;
  comentario?: string | null;
  /** Solo admin: entregar desde un estado fuera del circuito. */
  forzar?: boolean;
  puedeForzar: boolean;
  /**
   * Salta el control de cuenta corriente porque un supervisor ya autorizó el
   * fiado. Es el único camino para dejar deuda en un cliente no habilitado.
   */
  autorizadoPor?: { usuarioId: number; nombre: string } | null;
}

export interface ResultadoEntrega {
  /** Deuda nueva que dejó la entrega, ya descontado el saldo a favor. */
  pendiente: number;
  /** Cuánto saldo a favor del cliente se usó para cubrirla. */
  creditoAplicado: number;
  notificacion: ResultadoNotificacion;
}

/**
 * Entrega del equipo: cambia el estado y registra el cobro en un solo paso.
 *
 * Vive en un servicio y no en el controlador porque hay dos puertas que llegan
 * acá: el mostrador entregando de una, y un supervisor aprobando el fiado que
 * el mostrador no podía autorizar. Las dos tienen que hacer exactamente lo
 * mismo, o el equipo aprobado saldría sin quedar asentado igual.
 */
export async function ejecutarEntrega(input: EntregaInput): Promise<ResultadoEntrega> {
  const { orden, cliente } = input;
  const estadoAnterior = orden.estado;

  if (estadoAnterior === 'entregado') {
    throw new HttpError(409, 'La orden ya fue entregada');
  }

  const transicionValida = esTransicionValida(estadoAnterior, 'entregado');
  if (!transicionValida) {
    if (!(input.forzar === true && input.puedeForzar)) {
      throw new HttpError(
        409,
        `Una orden en "${etiquetaEstado(estadoAnterior)}" no se puede entregar todavía.`
      );
    }
    if (!input.comentario?.trim()) {
      throw new HttpError(400, 'Para entregar fuera del circuito hay que indicar el motivo');
    }
  }

  const total = redondearMonto(input.montoTotal);
  const abonado = redondearMonto(input.montoAbonado);
  if (abonado > total) {
    throw new HttpError(400, 'Lo abonado no puede superar el total de la orden');
  }

  // El saldo se lee dentro de la transacción, junto con los asientos que va a
  // generar la entrega: leerlo antes deja una ventana en la que otro cobro del
  // mismo cliente cambia el crédito disponible entre el cálculo y la escritura.
  let creditoAplicado = 0;
  let pendiente = 0;

  await sequelize.transaction(async (t) => {
    const saldoPrevio = await saldoDeCliente(input.tallerId, cliente.id, t);
    ({ creditoAplicado, pendiente } = repartirEntrega(saldoPrevio, total, abonado));

    if (!input.autorizadoPor) {
      exigirCuentaCorriente(cliente, pendiente);
    }

    await orden.update(
      {
        estado: 'entregado',
        montoTotal: total.toFixed(2),
        montoAbonado: abonado.toFixed(2),
        creditoAplicado: creditoAplicado.toFixed(2),
        fechaEntrega: new Date()
      },
      { transaction: t }
    );

    // Se anotan los dos movimientos por separado —lo facturado y lo cobrado— en
    // vez de solo la diferencia: así la cuenta del cliente muestra qué se le
    // cobró y qué pagó, y no un neto que no se puede explicar.
    if (total > 0) {
      await registrarCargo({
        tallerId: input.tallerId,
        clienteId: cliente.id,
        usuarioId: input.usuarioId,
        ordenId: orden.id,
        sucursalId: input.sucursalId,
        monto: total,
        nota: `Orden ${orden.numeroOrden}`,
        transaction: t
      });
    }

    if (abonado > 0) {
      await registrarPago({
        tallerId: input.tallerId,
        clienteId: cliente.id,
        usuarioId: input.usuarioId,
        ordenId: orden.id,
        sucursalId: input.sucursalId,
        monto: abonado,
        medioPago: input.medioPago ?? null,
        nota: `Cobro al entregar la orden ${orden.numeroOrden}`,
        transaction: t
      });
    }

    await OrdenHistorialEstado.create(
      {
        ordenId: orden.id,
        estadoAnterior,
        estadoNuevo: 'entregado',
        usuarioId: input.usuarioId,
        comentario: armarComentario({
          forzado: !transicionValida,
          total,
          abonado,
          pendiente,
          creditoAplicado,
          autorizadoPor: input.autorizadoPor?.nombre ?? null,
          comentario: input.comentario ?? null
        })
      },
      { transaction: t }
    );
  });

  // El aviso al cliente se manda después de cerrar la transacción: si el correo
  // falla, la entrega ya quedó registrada igual.
  const notificacion = await notificarCambioEstadoOrden(orden, cliente);

  return { pendiente, creditoAplicado, notificacion };
}

interface PartesComentario {
  forzado: boolean;
  total: number;
  abonado: number;
  pendiente: number;
  creditoAplicado: number;
  autorizadoPor: string | null;
  comentario: string | null;
}

/** Deja en el historial qué se cobró, qué quedó debiendo y quién lo autorizó. */
function armarComentario(partes: PartesComentario): string {
  return [
    partes.forzado ? '[Forzado]' : null,
    `Entregado. Total ${partes.total.toFixed(2)}; abonó ${partes.abonado.toFixed(2)}.`,
    partes.creditoAplicado > 0 ? `Se aplicaron ${partes.creditoAplicado.toFixed(2)} de saldo a favor.` : null,
    partes.pendiente > 0 ? `Queda ${partes.pendiente.toFixed(2)} en cuenta corriente.` : null,
    partes.autorizadoPor ? `Fiado autorizado por ${partes.autorizadoPor}.` : null,
    partes.comentario?.trim() || null
  ]
    .filter(Boolean)
    .join(' ');
}

/** Reutilizable desde la aprobación: la orden con su cliente, ya validada. */
export async function buscarOrdenParaEntrega(
  ordenId: number,
  transaction?: Transaction
): Promise<{ orden: Orden; cliente: Cliente }> {
  const orden = await Orden.findByPk(ordenId, {
    include: [{ model: Cliente, as: 'cliente' }],
    transaction
  });
  if (!orden) throw new HttpError(404, 'Orden no encontrada');

  const cliente = (orden as any).cliente as Cliente | undefined;
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');

  return { orden, cliente };
}
