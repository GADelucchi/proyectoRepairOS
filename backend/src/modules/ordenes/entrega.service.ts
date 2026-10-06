import { Transaction } from 'sequelize';
import { sequelize, Orden, OrdenHistorialEstado, Solicitud } from '../../models';
import { MedioPago } from '../../models/CuentaMovimiento';
import { errores } from '../../shared/http/http-error';
import { Moneda, montoConMoneda, redondearMonto } from '../../shared/utils/dinero';
import { esTransicionValida, etiquetaEstado } from './estado-orden';
import { notificarCambioEstadoOrden, ResultadoNotificacion } from '../notificaciones/notificaciones.service';
import {
  bloquearCliente,
  exigirCuentaCorriente,
  registrarCargo,
  registrarPago,
  repartirEntrega,
  saldoDeCliente
} from '../cuentas/cuenta-corriente.service';

export interface EntregaInput {
  ordenId: number;
  tallerId: number;
  /** Quien recibe la plata y queda como responsable de la entrega. */
  usuarioId: number;
  /** Sucursal donde entra la plata. Si no se indica, la de la orden. */
  sucursalId?: number | null;
  montoTotal: number;
  montoAbonado: number;
  medioPago?: MedioPago | null;
  comentario?: string | null;
  /** Para el taller: queda en el historial pero no se imprime en el remito. */
  notaInterna?: string | null;
  /**
   * Moneda en la que se pidió el cobro. La entrega cobra siempre en la moneda
   * de la orden; si se indica y no coincide (alguien cambió la moneda del
   * presupuesto mientras esperaba una autorización), se corta.
   */
  monedaEsperada?: Moneda;
  /** Entregar desde un estado fuera del circuito (solo si `puedeForzar`). */
  forzar?: boolean;
  puedeForzar: boolean;
  /**
   * Un supervisor ya autorizó el fiado: se saltea el control de cuenta
   * corriente. Es el único camino para dejar deuda en un cliente no habilitado.
   */
  autorizadoPor?: string | null;
  /**
   * Trabajo extra que tiene que confirmarse junto con la entrega (por ejemplo,
   * cerrar la solicitud de fiado que la autorizó). Si falla, no se entrega nada.
   */
  enLaMismaTransaccion?: (transaction: Transaction) => Promise<void>;
}

export interface ResultadoEntrega {
  orden: Orden;
  /** Deuda nueva que dejó la entrega, ya descontado el saldo a favor. */
  pendiente: number;
  /** Cuánto saldo a favor del cliente se usó para cubrirla. */
  creditoAplicado: number;
  notificacion: ResultadoNotificacion;
}

/** Deja en el historial qué se cobró, qué quedó debiendo y quién lo autorizó. */
function comentarioDeEntrega(partes: {
  forzado: boolean;
  moneda: Moneda;
  total: number;
  abonado: number;
  pendiente: number;
  creditoAplicado: number;
  autorizadoPor?: string | null;
  comentario?: string | null;
}): string {
  const m = (valor: number) => montoConMoneda(valor, partes.moneda);
  return [
    partes.forzado ? '[Forzado]' : null,
    `Entregado. Total ${m(partes.total)}; abonó ${m(partes.abonado)}.`,
    partes.creditoAplicado > 0 ? `Se aplicaron ${m(partes.creditoAplicado)} de saldo a favor.` : null,
    partes.pendiente > 0 ? `Queda ${m(partes.pendiente)} en cuenta corriente.` : null,
    partes.autorizadoPor ? `Fiado autorizado por ${partes.autorizadoPor}.` : null,
    partes.comentario?.trim() || null
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Entrega del equipo: cambia el estado y registra el cobro en un solo paso.
 *
 * Hay dos puertas que llegan acá —el mostrador entregando y un supervisor
 * aprobando un fiado— y las dos tienen que registrar exactamente lo mismo.
 *
 * Todo pasa dentro de una transacción con la orden y el cliente bloqueados: dos
 * clics simultáneos en "Entregar" (o una entrega y una aprobación a la vez) se
 * serializan, y el segundo encuentra la orden ya entregada en vez de asentar el
 * cobro dos veces.
 */
export async function ejecutarEntrega(input: EntregaInput): Promise<ResultadoEntrega> {
  const total = redondearMonto(input.montoTotal);
  const abonado = redondearMonto(input.montoAbonado);
  if (abonado > total) throw errores.solicitudInvalida('Lo abonado no puede superar el total de la orden');

  const resultado = await sequelize.transaction(async (transaction) => {
    const orden = await Orden.findOne({
      where: { id: input.ordenId, tallerId: input.tallerId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!orden) throw errores.noEncontrado('Orden');

    const estadoAnterior = orden.estado;
    if (estadoAnterior === 'entregado') throw errores.conflicto('La orden ya fue entregada');

    const moneda = orden.moneda;
    if (input.monedaEsperada && input.monedaEsperada !== moneda) {
      throw errores.conflicto(
        `La orden ahora se cobra en ${moneda} y el pedido era en ${input.monedaEsperada}. Hay que volver a pedirlo.`
      );
    }

    const forzado = !esTransicionValida(estadoAnterior, 'entregado');
    if (forzado) {
      if (!(input.forzar && input.puedeForzar)) {
        throw errores.conflicto(
          `Una orden en "${etiquetaEstado(estadoAnterior)}" no se puede entregar todavía.`
        );
      }
      if (!input.comentario?.trim()) {
        throw errores.solicitudInvalida('Para entregar fuera del circuito hay que indicar el motivo');
      }
    }

    const cliente = await bloquearCliente(orden.clienteId, transaction);
    const saldoPrevio = await saldoDeCliente(input.tallerId, cliente.id, moneda, transaction);
    const { creditoAplicado, pendiente } = repartirEntrega(saldoPrevio, total, abonado);

    if (!input.autorizadoPor) exigirCuentaCorriente(cliente, pendiente);

    await orden.update(
      {
        estado: 'entregado',
        montoTotal: total.toFixed(2),
        montoAbonado: abonado.toFixed(2),
        creditoAplicado: creditoAplicado.toFixed(2),
        fechaEntrega: new Date()
      },
      { transaction }
    );

    // Lo facturado y lo cobrado van en asientos separados, no como un neto:
    // así la cuenta del cliente muestra qué se le cobró y qué pagó.
    const movimiento = {
      tallerId: input.tallerId,
      clienteId: cliente.id,
      usuarioId: input.usuarioId,
      ordenId: orden.id,
      sucursalId: input.sucursalId ?? orden.sucursalId,
      moneda,
      transaction
    };
    if (total > 0) await registrarCargo({ ...movimiento, monto: total, nota: `Orden ${orden.numeroOrden}` });
    if (abonado > 0) {
      await registrarPago({
        ...movimiento,
        monto: abonado,
        medioPago: input.medioPago ?? null,
        nota: `Cobro al entregar la orden ${orden.numeroOrden}`
      });
    }

    await OrdenHistorialEstado.create(
      {
        ordenId: orden.id,
        estadoAnterior,
        estadoNuevo: 'entregado',
        usuarioId: input.usuarioId,
        comentario: comentarioDeEntrega({
          forzado,
          moneda,
          total,
          abonado,
          pendiente,
          creditoAplicado,
          autorizadoPor: input.autorizadoPor,
          comentario: input.comentario
        }),
        notaInterna: input.notaInterna?.trim() || null
      },
      { transaction }
    );

    await input.enLaMismaTransaccion?.(transaction);

    // Un pedido de fiado que quedó esperando para esta orden ya no tiene sentido.
    await Solicitud.update(
      {
        estado: 'cancelada',
        resueltoPorId: input.usuarioId,
        resueltoEn: new Date(),
        respuesta: 'La orden se entregó por otra vía'
      },
      { where: { ordenId: orden.id, tipo: 'fiado', estado: 'pendiente' }, transaction }
    );

    return { orden, cliente, pendiente, creditoAplicado };
  });

  // El aviso sale después de confirmar: si el correo falla, la entrega ya quedó registrada.
  const notificacion = await notificarCambioEstadoOrden(resultado.orden, resultado.cliente);

  return {
    orden: resultado.orden,
    pendiente: resultado.pendiente,
    creditoAplicado: resultado.creditoAplicado,
    notificacion
  };
}
