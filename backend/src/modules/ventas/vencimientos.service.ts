import { Op } from 'sequelize';
import { env } from '../../config/env';
import { Cliente, EquipoStock, User, Venta, VentaItem, VentaPago, sequelize } from '../../models';
import { fechaEnZona } from '../../shared/utils/fechas';
import { nombreCompleto } from '../../shared/utils/texto';
import { notificarEnLaApp } from '../notificaciones/notificaciones.service';
import { etiquetaVenta } from './calculos';

/** Días con una seña sin completar a partir de los que se avisa a los admins. */
export const DIAS_AVISO_SENA = 15;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Una reserva con la fecha pasada vence: la venta queda como vencida (no se
 * borra) y sus equipos vuelven a estar disponibles. Una seña no vence sola,
 * porque el cliente dejó plata: a los 15 días se avisa a los admins, una vez.
 *
 * No hay un proceso aparte que lo corra: se revisa al mirar el stock o las
 * ventas, y con la campanita, que cada usuario consulta cada minuto.
 */
export async function revisarVencimientos(tallerId: number): Promise<void> {
  await Promise.all([vencerReservas(tallerId), avisarSenasViejas(tallerId)]);
}

async function vencerReservas(tallerId: number) {
  const hoy = fechaEnZona(new Date(), env.timezone);
  const vencidas = await Venta.findAll({
    where: { tallerId, estado: 'reservada', reservadaHasta: { [Op.lt]: hoy } },
    attributes: ['id'],
    include: [{ model: VentaItem, as: 'items', attributes: ['equipoStockId'] }]
  });

  for (const venta of vencidas) {
    await sequelize.transaction(async (transaction) => {
      // Si otro request ya la venció (o la pagaron recién), no hay nada que hacer.
      const [cambiadas] = await Venta.update(
        { estado: 'vencida' },
        { where: { id: venta.id, estado: 'reservada' }, transaction }
      );
      if (!cambiadas) return;
      await EquipoStock.update(
        { estado: 'disponible' },
        {
          where: { id: (venta.items ?? []).map((i) => i.equipoStockId), estado: 'reservado' },
          transaction
        }
      );
    });
  }
}

async function avisarSenasViejas(tallerId: number) {
  const limite = new Date(Date.now() - DIAS_AVISO_SENA * DIA_MS);
  const senadas = await Venta.findAll({
    where: { tallerId, estado: 'senada', avisoSenaEn: null, createdAt: { [Op.lte]: limite } },
    attributes: ['id', 'numero'],
    include: [
      { model: Cliente, as: 'cliente', attributes: ['nombre', 'apellido'] },
      { model: VentaPago, as: 'pagos', attributes: ['tipo', 'createdAt'] }
    ]
  });
  // Los días se cuentan desde la primera seña: una reserva que se señó después arranca ahí.
  const viejas = senadas.filter((venta) => {
    const primera = Math.min(
      ...(venta.pagos ?? []).filter((p) => p.tipo === 'sena').map((p) => p.createdAt.getTime())
    );
    return Number.isFinite(primera) && primera <= limite.getTime();
  });
  if (viejas.length === 0) return;

  const admins = await User.findAll({ where: { tallerId, rol: 'admin', activo: true }, attributes: ['id'] });
  for (const venta of viejas) {
    const [marcadas] = await Venta.update(
      { avisoSenaEn: new Date() },
      { where: { id: venta.id, avisoSenaEn: null } }
    );
    if (!marcadas) continue;
    await notificarEnLaApp(
      admins.map((a) => a.id),
      {
        tipo: 'venta',
        titulo: `Seña de ${etiquetaVenta(venta.numero)} sin completar`,
        mensaje: `${nombreCompleto(venta.cliente)} señó hace más de ${DIAS_AVISO_SENA} días y todavía no completó la compra. Los equipos siguen apartados: completala, extendela o cancelala.`,
        link: `/ventas/${venta.id}`
      }
    );
  }
}

const ultimaRevision = new Map<number, number>();
const CADA_MS = 5 * 60_000;

/** Lo mismo, como mucho cada 5 minutos por taller: para la campanita, que se consulta seguido. */
export async function revisarVencimientosSiToca(tallerId: number): Promise<void> {
  const ahora = Date.now();
  if (ahora - (ultimaRevision.get(tallerId) ?? 0) < CADA_MS) return;
  ultimaRevision.set(tallerId, ahora);
  await revisarVencimientos(tallerId).catch((err) => console.error('[ventas] vencimientos:', err));
}
