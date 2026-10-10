import { z } from 'zod';
import { Orden, User } from '../../models';
import { errores } from '../../shared/http/http-error';
import { nombreCompleto } from '../../shared/utils/texto';
import { repartirEntrega } from '../cuentas/cuenta-corriente.service';
import { fiarComoAdmin, pedirFiado } from '../solicitudes/solicitudes.service';
import { solicitarFiadoSchema } from './ordenes.schemas';
import { saldoEnMonedaDe } from './ordenes.service';

/**
 * Pide autorización para entregar dejando deuda en un cliente sin cuenta
 * corriente: la salida del mostrador cuando la entrega se rechaza y el cliente
 * está esperando en el local. La orden tiene que venir con su cliente.
 *
 * Si quien pide ya es admin, no espera su propia aprobación: se entrega en el
 * acto y queda igual la solicitud aprobada como registro del responsable.
 */
export async function solicitarFiado(
  orden: Orden,
  { montoTotal, montoAbonado, medioPago, motivo }: z.infer<typeof solicitarFiadoSchema>,
  quien: { usuarioId: number; sucursalId: number; esAdmin: boolean }
) {
  const cliente = orden.cliente!;

  if (orden.estado === 'entregado') throw errores.conflicto('La orden ya fue entregada');
  if (cliente.cuentaCorrienteHabilitada) {
    throw errores.solicitudInvalida(
      'El cliente ya tiene cuenta corriente: la entrega se puede hacer directo'
    );
  }

  // Con el saldo a favor descontado puede no quedar deuda: no hay nada que autorizar.
  const { pendiente } = repartirEntrega(await saldoEnMonedaDe(orden), montoTotal, montoAbonado);
  if (pendiente <= 0) throw errores.solicitudInvalida('No hace falta autorización: la orden queda cubierta');

  const pedido = {
    tallerId: orden.tallerId,
    solicitanteId: quien.usuarioId,
    sucursalId: quien.sucursalId,
    cliente,
    ordenId: orden.id,
    pendiente,
    moneda: orden.moneda,
    motivo,
    datos: { montoTotal, montoAbonado, medioPago: medioPago ?? null }
  };

  if (!quien.esAdmin) {
    return { solicitud: await pedirFiado(pedido), autorizada: false };
  }

  const admin = await User.findByPk(quien.usuarioId, { attributes: ['nombre', 'apellido'] });
  const { solicitud, entrega } = await fiarComoAdmin(pedido, nombreCompleto(admin) || 'un administrador');

  return {
    solicitud,
    autorizada: true,
    notificacion: entrega.notificacion,
    creditoAplicado: entrega.creditoAplicado,
    saldoCliente: await saldoEnMonedaDe(orden)
  };
}
