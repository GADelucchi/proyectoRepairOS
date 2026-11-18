import { Op, Transaction, fn, col } from 'sequelize';
import {
  Articulo,
  Contador,
  InventarioConsumo,
  InventarioEntrada,
  InventarioMovimiento,
  Sucursal,
  Taller,
  VentaItem
} from '../../models';
import type { OrigenConsumo } from '../../models/InventarioConsumo';
import type { TipoMovimientoInventario } from '../../models/InventarioMovimiento';
import { errores } from '../../shared/http/http-error';
import { type Moneda, aNumero, redondearMonto } from '../../shared/utils/dinero';
import { avisarASucursal } from '../notificaciones/notificaciones.service';
import { configDeInventario } from './config';
import { repartirPorAntiguedad } from './fifo';

/** Quién opera y desde qué sucursal. Los costos los ve solo un admin. */
export interface ContextoInventario {
  tallerId: number;
  sucursalId: number;
  usuarioId: number;
  esAdmin: boolean;
}

/** Un costo por unidad en dólares, con la precisión con que se guarda. */
export function costoUnitarioUsd(
  costo: number,
  moneda: Moneda,
  cotizacion: number | null | undefined
): number {
  if (moneda === 'USD') return Number(costo.toFixed(4));
  if (!cotizacion || cotizacion <= 0) {
    throw errores.solicitudInvalida(
      `Indicá la cotización: cuántos ${moneda} vale 1 US$. El costo se informa en dólares.`
    );
  }
  return Number((costo / cotizacion).toFixed(4));
}

interface DatosMovimiento {
  sucursalId: number;
  articuloId: number;
  entradaId: number | null;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  ordenId?: number | null;
  ventaId?: number | null;
  paseId?: number | null;
  equipoStockId?: number | null;
  nota?: string | null;
}

/** Deja asentado un cambio de cantidad en el historial del producto. */
export function registrarMovimiento(
  ctx: { tallerId: number; usuarioId: number | null },
  datos: DatosMovimiento,
  transaction: Transaction
) {
  return InventarioMovimiento.create(
    {
      tallerId: ctx.tallerId,
      usuarioId: ctx.usuarioId,
      ...datos,
      nota: datos.nota?.slice(0, 255) ?? null
    },
    { transaction }
  );
}

/** Lo que hay de un producto en una sucursal, sumando sus entradas. */
export async function existenciaEn(articuloId: number, sucursalId: number, transaction?: Transaction) {
  const total = await InventarioEntrada.sum('disponible', { where: { articuloId, sucursalId }, transaction });
  return aNumero(total);
}

/** Lo que hay de cada producto en una sucursal (o en todas, con null). */
export async function existencias(
  tallerId: number,
  sucursalId: number | null,
  articuloIds?: number[]
): Promise<Map<number, number>> {
  const filas = (await InventarioEntrada.findAll({
    where: {
      tallerId,
      ...(sucursalId ? { sucursalId } : {}),
      ...(articuloIds ? { articuloId: articuloIds } : {})
    },
    attributes: ['articuloId', [fn('SUM', col('disponible')), 'cantidad']],
    group: ['articuloId'],
    raw: true
  })) as unknown as { articuloId: number; cantidad: string | number }[];
  return new Map(filas.map((f) => [f.articuloId, Number(f.cantidad)]));
}

export interface NuevaEntrada {
  articulo: Articulo;
  sucursalId: number;
  cantidad: number;
  moneda: Moneda;
  costo: number;
  cotizacion: number | null;
  fecha: string;
  proveedor?: string | null;
  nota?: string | null;
  /** Lo que llega por un pase: conserva la entrada de origen y su fecha. */
  pase?: { id: number; entradaOrigenId: number };
  /** Unidades que aparecieron al contar (ajuste de un admin). */
  ajuste?: boolean;
}

/** Una entrada nueva: suma unidades a la sucursal con lo que costó cada una. */
export async function ingresarEntrada(
  ctx: ContextoInventario,
  datos: NuevaEntrada,
  transaction: Transaction
) {
  if (datos.articulo.tipo === 'servicio') throw errores.solicitudInvalida('Un servicio no tiene stock.');
  const numero = await Contador.reservarSiguiente(`entrada:${ctx.tallerId}`, transaction);
  const entrada = await InventarioEntrada.create(
    {
      tallerId: ctx.tallerId,
      sucursalId: datos.sucursalId,
      articuloId: datos.articulo.id,
      numero,
      origen: datos.pase ? 'pase' : datos.ajuste ? 'ajuste' : 'compra',
      paseId: datos.pase?.id ?? null,
      entradaOrigenId: datos.pase?.entradaOrigenId ?? null,
      fecha: datos.fecha,
      cantidad: datos.cantidad,
      disponible: datos.cantidad,
      moneda: datos.moneda,
      costo: datos.costo.toFixed(2),
      cotizacion: datos.moneda === 'USD' ? null : (datos.cotizacion?.toFixed(4) ?? null),
      costoUsd: costoUnitarioUsd(datos.costo, datos.moneda, datos.cotizacion).toFixed(4),
      proveedor: datos.proveedor ?? null,
      nota: datos.nota ?? null,
      cargadaPorId: ctx.usuarioId
    },
    { transaction }
  );
  await registrarMovimiento(
    ctx,
    {
      sucursalId: datos.sucursalId,
      articuloId: datos.articulo.id,
      entradaId: entrada.id,
      tipo: datos.pase ? 'pase_entrada' : datos.ajuste ? 'ajuste' : 'entrada',
      cantidad: datos.cantidad,
      paseId: datos.pase?.id ?? null,
      nota: datos.ajuste ? (datos.nota ?? null) : (datos.proveedor ?? null)
    },
    transaction
  );
  return entrada;
}

/** A qué se le cargan las unidades que se usan. */
export interface DestinoConsumo {
  origen: OrigenConsumo;
  ordenId?: number | null;
  ordenServicioId?: number | null;
  ventaId?: number | null;
  ventaItemId?: number | null;
  equipoStockId?: number | null;
  equipoStockCostoId?: number | null;
}

const MOVIMIENTO_DE: Record<OrigenConsumo, TipoMovimientoInventario> = {
  orden: 'orden',
  venta: 'venta',
  equipo_stock: 'equipo_stock'
};

const DEVOLUCION_DE: Record<OrigenConsumo, TipoMovimientoInventario> = {
  orden: 'orden_devolucion',
  venta: 'venta_devolucion',
  equipo_stock: 'equipo_stock_devolucion'
};

/**
 * Las entradas con unidades de un producto en una sucursal, de la más vieja a
 * la más nueva, bloqueadas hasta el final de la transacción: dos mostradores no
 * pueden usar la misma unidad.
 */
function entradasConStock(articuloId: number, sucursalId: number, transaction: Transaction) {
  return InventarioEntrada.findAll({
    where: { articuloId, sucursalId, disponible: { [Op.gt]: 0 } },
    order: [
      ['fecha', 'ASC'],
      ['id', 'ASC']
    ],
    lock: transaction.LOCK.UPDATE,
    transaction
  });
}

/**
 * Saca `cantidad` unidades de un producto de la sucursal, de la entrada más
 * vieja (o de la elegida), y las carga a una orden, una venta o un equipo del
 * stock. Devuelve los consumos (uno por entrada) y su costo total en dólares.
 */
export async function consumir(
  ctx: ContextoInventario,
  datos: {
    articulo: Articulo;
    sucursalId: number;
    cantidad: number;
    entradaPreferida?: number | null;
    destino: DestinoConsumo;
    nota?: string | null;
  },
  transaction: Transaction
) {
  const { articulo, sucursalId, cantidad, destino } = datos;
  if (articulo.tipo === 'servicio') throw errores.solicitudInvalida('Un servicio no tiene stock.');
  if (!articulo.activo) throw errores.conflicto(`${articulo.nombre} está archivado.`);

  const entradas = await entradasConStock(articulo.id, sucursalId, transaction);
  const tomados = repartirPorAntiguedad(entradas, cantidad, datos.entradaPreferida);
  if (!tomados) {
    const hay = entradas.reduce((t, e) => t + e.disponible, 0);
    throw errores.conflicto(
      `No hay suficiente ${articulo.nombre} en esta sucursal: ${hay === 0 ? 'no queda ninguno' : `quedan ${hay}`}.`
    );
  }

  const consumos: InventarioConsumo[] = [];
  let costoUsd = 0;
  for (const tomado of tomados) {
    const entrada = entradas.find((e) => e.id === tomado.entradaId)!;
    await entrada.update({ disponible: entrada.disponible - tomado.cantidad }, { transaction });
    consumos.push(
      await InventarioConsumo.create(
        {
          tallerId: ctx.tallerId,
          sucursalId,
          articuloId: articulo.id,
          entradaId: entrada.id,
          cantidad: tomado.cantidad,
          costoUsd: entrada.costoUsd,
          origen: destino.origen,
          ordenId: destino.ordenId ?? null,
          ordenServicioId: destino.ordenServicioId ?? null,
          ventaItemId: destino.ventaItemId ?? null,
          equipoStockCostoId: destino.equipoStockCostoId ?? null,
          usuarioId: ctx.usuarioId
        },
        { transaction }
      )
    );
    await registrarMovimiento(
      ctx,
      {
        sucursalId,
        articuloId: articulo.id,
        entradaId: entrada.id,
        tipo: MOVIMIENTO_DE[destino.origen],
        cantidad: -tomado.cantidad,
        ordenId: destino.ordenId ?? null,
        ventaId: destino.ventaId ?? null,
        equipoStockId: destino.equipoStockId ?? null,
        nota: datos.nota ?? null
      },
      transaction
    );
    costoUsd += tomado.cantidad * aNumero(entrada.costoUsd);
  }

  avisarSiQuedaPoco(ctx, articulo, sucursalId, cantidad, transaction);
  return { consumos, costoUsd: redondearMonto(costoUsd) };
}

/** Las unidades vuelven a la entrada de la que salieron. */
export async function devolverConsumo(
  ctx: { tallerId: number; usuarioId: number | null },
  consumo: InventarioConsumo,
  refs: { ventaId?: number | null; equipoStockId?: number | null; nota?: string | null },
  transaction: Transaction
) {
  if (consumo.estado !== 'usado') return;
  const entrada = await InventarioEntrada.findByPk(consumo.entradaId, {
    lock: transaction.LOCK.UPDATE,
    transaction
  });
  if (!entrada) throw errores.noEncontrado('Entrada');
  await entrada.update({ disponible: entrada.disponible + consumo.cantidad }, { transaction });
  await consumo.update({ estado: 'devuelto' }, { transaction });
  await registrarMovimiento(
    ctx,
    {
      sucursalId: consumo.sucursalId,
      articuloId: consumo.articuloId,
      entradaId: consumo.entradaId,
      tipo: DEVOLUCION_DE[consumo.origen],
      cantidad: consumo.cantidad,
      ordenId: consumo.ordenId,
      ventaId: refs.ventaId ?? null,
      equipoStockId: refs.equipoStockId ?? null,
      nota: refs.nota ?? null
    },
    transaction
  );
}

/**
 * Se rompió al usarlo: no vuelve al stock y sigue siendo costo de lo que lo
 * usó. Las unidades ya habían salido, así que solo queda asentado el motivo.
 */
export async function marcarPerdido(
  ctx: ContextoInventario,
  consumo: InventarioConsumo,
  motivo: string | null,
  transaction: Transaction
) {
  if (consumo.estado !== 'usado') throw errores.conflicto('Ese repuesto ya no está en uso.');
  await consumo.update({ estado: 'perdido', motivo }, { transaction });
  await registrarMovimiento(
    ctx,
    {
      sucursalId: consumo.sucursalId,
      articuloId: consumo.articuloId,
      entradaId: consumo.entradaId,
      tipo: 'perdida',
      cantidad: 0,
      ordenId: consumo.ordenId,
      nota: motivo || 'Se perdió al usarlo'
    },
    transaction
  );
}

/**
 * Si después de usar unidades la sucursal quedó por debajo del mínimo (y antes
 * no lo estaba), avisa cuando se confirma la transacción: en la campanita a la
 * sucursal y por correo a los admins, según la configuración del taller.
 */
function avisarSiQuedaPoco(
  ctx: ContextoInventario,
  articulo: Articulo,
  sucursalId: number,
  usados: number,
  transaction: Transaction
) {
  if (articulo.stockMinimo <= 0) return;
  transaction.afterCommit(async () => {
    try {
      const quedan = await existenciaEn(articulo.id, sucursalId);
      if (quedan >= articulo.stockMinimo || quedan + usados < articulo.stockMinimo) return;
      const [taller, sucursal] = await Promise.all([
        Taller.findByPk(ctx.tallerId, { attributes: ['inventarioConfig'] }),
        Sucursal.findByPk(sucursalId, { attributes: ['nombre'] })
      ]);
      const config = configDeInventario(taller?.inventarioConfig);
      if (!config.avisoApp && !config.avisoEmail) return;
      const titulo = `Quedan ${quedan} de ${articulo.nombre}`;
      const mensaje = `${sucursal?.nombre ?? 'La sucursal'} quedó por debajo del mínimo (${articulo.stockMinimo}).`;
      await avisarASucursal(
        'inventario',
        ctx.tallerId,
        sucursalId,
        config.avisoApp ? { titulo, mensaje, link: `/inventario/articulos/${articulo.id}` } : null,
        config.avisoEmail
          ? {
              asunto: titulo,
              parrafos: [mensaje, 'Entrá a RepairOS, sección Inventario, para cargar una compra.']
            }
          : undefined
      );
    } catch (err) {
      console.error('[inventario] aviso de stock mínimo:', err);
    }
  });
}

/**
 * Los accesorios y repuestos de una venta vuelven a las entradas de las que
 * salieron: al cancelarla, anularla o al vencer la reserva.
 */
export async function devolverArticulosDeVenta(
  ctx: { tallerId: number; usuarioId: number | null },
  ventaId: number,
  nota: string,
  transaction: Transaction
) {
  const renglones = await VentaItem.findAll({
    where: { ventaId, articuloId: { [Op.ne]: null } },
    attributes: ['id'],
    transaction
  });
  if (renglones.length === 0) return;
  const consumos = await InventarioConsumo.findAll({
    where: { ventaItemId: renglones.map((r) => r.id), estado: 'usado' },
    lock: transaction.LOCK.UPDATE,
    transaction
  });
  for (const consumo of consumos) await devolverConsumo(ctx, consumo, { ventaId, nota }, transaction);
}
