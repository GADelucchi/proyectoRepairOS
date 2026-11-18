import { Op, Transaction } from 'sequelize';
import {
  Articulo,
  Contador,
  EquipoStock,
  InventarioEntrada,
  Pase,
  PaseItem,
  Sucursal,
  User,
  sequelize
} from '../../models';
import type { EstadoPase } from '../../models/Pase';
import { errores } from '../../shared/http/http-error';
import { aNumero } from '../../shared/utils/dinero';
import { avisarASucursal } from '../notificaciones/notificaciones.service';
import { etiquetaNumero } from '../stock/stock.service';
import { etiquetaEntrada, etiquetaPase } from './config';
import { type ContextoInventario, ingresarEntrada, registrarMovimiento } from './existencias.service';
import { repartirPorAntiguedad } from './fifo';
import type { NuevoPaseInput } from './inventario.schemas';

const USUARIO = ['id', 'nombre', 'apellido'];

const INCLUDES = [
  { model: Sucursal, as: 'sucursalOrigen', attributes: ['id', 'nombre'] },
  { model: Sucursal, as: 'sucursalDestino', attributes: ['id', 'nombre'] },
  { model: User, as: 'enviadoPor', attributes: USUARIO },
  { model: User, as: 'recibidoPor', attributes: USUARIO },
  { model: User, as: 'canceladoPor', attributes: USUARIO },
  {
    model: PaseItem,
    as: 'items',
    include: [
      { model: Articulo, as: 'articulo', attributes: ['id', 'codigo', 'nombre', 'tipo'] },
      { model: InventarioEntrada, as: 'entrada', attributes: ['id', 'numero', 'fecha', 'costoUsd'] },
      {
        model: EquipoStock,
        as: 'equipo',
        attributes: ['id', 'numero', 'marca', 'modelo', 'color', 'almacenamientoGb']
      }
    ]
  }
];

function serializarPase(pase: Pase, verCostos: boolean) {
  return {
    id: pase.id,
    numero: pase.numero,
    etiqueta: etiquetaPase(pase.numero),
    estado: pase.estado,
    nota: pase.nota,
    sucursalOrigen: pase.sucursalOrigen,
    sucursalDestino: pase.sucursalDestino,
    enviadoPor: pase.enviadoPor,
    recibidoPor: pase.recibidoPor,
    canceladoPor: pase.canceladoPor,
    createdAt: pase.createdAt,
    recibidoEn: pase.recibidoEn,
    canceladoEn: pase.canceladoEn,
    items: (pase.items ?? []).map((i) => ({
      id: i.id,
      cantidad: i.cantidad,
      articulo: i.articulo ?? null,
      entrada: i.entrada
        ? {
            id: i.entrada.id,
            etiqueta: etiquetaEntrada(i.entrada.numero),
            costoUsd: verCostos ? aNumero(i.entrada.costoUsd) : null
          }
        : null,
      equipo: i.equipo
        ? { ...i.equipo.get({ plain: true }), etiqueta: etiquetaNumero(i.equipo.numero) }
        : null
    }))
  };
}

/** Los pases que salieron de la sucursal o que llegan a ella: los que siguen en camino primero. */
export async function listarPases(ctx: ContextoInventario, estado?: EstadoPase) {
  const pases = await Pase.findAll({
    where: {
      tallerId: ctx.tallerId,
      [Op.or]: [{ sucursalOrigenId: ctx.sucursalId }, { sucursalDestinoId: ctx.sucursalId }],
      ...(estado ? { estado } : {})
    },
    include: INCLUDES,
    order: [
      [sequelize.literal("`Pase`.`estado` = 'en_camino'"), 'DESC'],
      ['id', 'DESC']
    ],
    limit: 100
  });
  return pases.map((p) => serializarPase(p, ctx.esAdmin));
}

async function paseDelTaller(ctx: ContextoInventario, id: number, transaction?: Transaction) {
  const pase = await Pase.findOne({
    where: { id, tallerId: ctx.tallerId },
    include: INCLUDES,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    transaction
  });
  if (!pase || (pase.sucursalOrigenId !== ctx.sucursalId && pase.sucursalDestinoId !== ctx.sucursalId)) {
    throw errores.noEncontrado('Pase');
  }
  return pase;
}

export async function obtenerPase(ctx: ContextoInventario, id: number) {
  return serializarPase(await paseDelTaller(ctx, id), ctx.esAdmin);
}

/** Sumar items del mismo producto antes de repartir: "2 módulos" dos veces son 4. */
function agruparPorArticulo(items: NuevoPaseInput['items']) {
  const porArticulo = new Map<number, number>();
  for (const item of items) {
    if ('articuloId' in item)
      porArticulo.set(item.articuloId, (porArticulo.get(item.articuloId) ?? 0) + item.cantidad);
  }
  return porArticulo;
}

/**
 * Manda productos y equipos de la sucursal elegida a otra. Las unidades salen
 * de la entrada más vieja y dejan de estar en el stock de la origen; los
 * equipos quedan "en camino". Recién cuando la destino confirma que llegó,
 * entran a su stock. Se avisa a la sucursal destino.
 */
export async function crearPase(ctx: ContextoInventario, datos: NuevoPaseInput) {
  if (datos.sucursalDestinoId === ctx.sucursalId) {
    throw errores.solicitudInvalida('La sucursal de destino tiene que ser otra.');
  }
  const destino = await Sucursal.findOne({
    where: { id: datos.sucursalDestinoId, tallerId: ctx.tallerId, activo: true },
    attributes: ['id', 'nombre']
  });
  if (!destino) throw errores.noEncontrado('Sucursal');

  const porArticulo = agruparPorArticulo(datos.items);
  const equipoIds = datos.items.flatMap((i) => ('equipoStockId' in i ? [i.equipoStockId] : []));
  if (new Set(equipoIds).size !== equipoIds.length)
    throw errores.solicitudInvalida('El mismo equipo está dos veces.');

  const id = await sequelize.transaction(async (transaction) => {
    const numero = await Contador.reservarSiguiente(`pase:${ctx.tallerId}`, transaction);
    const pase = await Pase.create(
      {
        tallerId: ctx.tallerId,
        numero,
        sucursalOrigenId: ctx.sucursalId,
        sucursalDestinoId: destino.id,
        nota: datos.nota,
        enviadoPorId: ctx.usuarioId
      },
      { transaction }
    );

    for (const [articuloId, cantidad] of porArticulo) {
      const articulo = await Articulo.findOne({
        where: { id: articuloId, tallerId: ctx.tallerId },
        transaction
      });
      if (!articulo) throw errores.noEncontrado('Artículo');
      if (articulo.tipo === 'servicio')
        throw errores.solicitudInvalida('Un servicio no se pasa entre sucursales.');
      const entradas = await InventarioEntrada.findAll({
        where: { articuloId, sucursalId: ctx.sucursalId, disponible: { [Op.gt]: 0 } },
        order: [
          ['fecha', 'ASC'],
          ['id', 'ASC']
        ],
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      const tomados = repartirPorAntiguedad(entradas, cantidad);
      if (!tomados) {
        const hay = entradas.reduce((t, e) => t + e.disponible, 0);
        throw errores.conflicto(`No hay ${cantidad} de ${articulo.nombre} en esta sucursal: hay ${hay}.`);
      }
      for (const tomado of tomados) {
        const entrada = entradas.find((e) => e.id === tomado.entradaId)!;
        await entrada.update({ disponible: entrada.disponible - tomado.cantidad }, { transaction });
        await PaseItem.create(
          {
            paseId: pase.id,
            articuloId,
            entradaId: entrada.id,
            equipoStockId: null,
            cantidad: tomado.cantidad
          },
          { transaction }
        );
        await registrarMovimiento(
          ctx,
          {
            sucursalId: ctx.sucursalId,
            articuloId,
            entradaId: entrada.id,
            tipo: 'pase_salida',
            cantidad: -tomado.cantidad,
            paseId: pase.id,
            nota: `A ${destino.nombre}`
          },
          transaction
        );
      }
    }

    if (equipoIds.length) {
      const equipos = await EquipoStock.findAll({
        where: { id: equipoIds, tallerId: ctx.tallerId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (equipos.length !== equipoIds.length) throw errores.noEncontrado('Equipo');
      for (const equipo of equipos) {
        if (equipo.sucursalId !== ctx.sucursalId) {
          throw errores.conflicto(`${etiquetaNumero(equipo.numero)} no está en esta sucursal.`);
        }
        if (equipo.estado !== 'disponible') {
          throw errores.conflicto(
            `${etiquetaNumero(equipo.numero)} (${equipo.marca} ${equipo.modelo}) no está disponible: está apartado, vendido o ya en camino.`
          );
        }
        await equipo.update({ estado: 'en_camino' }, { transaction });
        await PaseItem.create(
          { paseId: pase.id, articuloId: null, entradaId: null, equipoStockId: equipo.id, cantidad: 1 },
          { transaction }
        );
      }
    }
    return pase.id;
  });

  const pase = await paseDelTaller(ctx, id);
  const origen = pase.sucursalOrigen?.nombre ?? 'Otra sucursal';
  await avisarASucursal('inventario', ctx.tallerId, destino.id, {
    titulo: `${origen} te manda ${etiquetaPase(pase.numero)}`,
    mensaje: `${resumenItems(pase)}. Cuando llegue, confirmá que lo recibiste.`,
    link: `/inventario/pases`
  }).catch((err) => console.error('[inventario] aviso de pase:', err));
  return serializarPase(pase, ctx.esAdmin);
}

function resumenItems(pase: Pase): string {
  return (pase.items ?? [])
    .map((i) => (i.equipo ? `${i.equipo.marca} ${i.equipo.modelo}` : `${i.cantidad} × ${i.articulo?.nombre}`))
    .join(', ');
}

/**
 * La sucursal destino confirma que llegó: cada unidad entra a su stock como
 * una entrada nueva con el costo y la fecha de la de origen, y los equipos
 * pasan a ser de esta sucursal.
 */
export async function recibirPase(ctx: ContextoInventario, id: number) {
  await sequelize.transaction(async (transaction) => {
    const pase = await paseDelTaller(ctx, id, transaction);
    if (pase.sucursalDestinoId !== ctx.sucursalId) {
      throw errores.sinPermiso('Lo confirma la sucursal a la que llega el pase.');
    }
    if (pase.estado !== 'en_camino') throw errores.conflicto('El pase ya se recibió o se canceló.');

    for (const item of pase.items ?? []) {
      if (item.equipoStockId) {
        await EquipoStock.update(
          { estado: 'disponible', sucursalId: ctx.sucursalId },
          { where: { id: item.equipoStockId, estado: 'en_camino' }, transaction }
        );
        continue;
      }
      const origen = await InventarioEntrada.findByPk(item.entradaId!, { transaction });
      const articulo = await Articulo.findByPk(item.articuloId!, { transaction });
      await ingresarEntrada(
        ctx,
        {
          articulo: articulo!,
          sucursalId: ctx.sucursalId,
          cantidad: item.cantidad,
          moneda: origen!.moneda,
          costo: aNumero(origen!.costo),
          cotizacion: origen!.cotizacion == null ? null : aNumero(origen!.cotizacion),
          fecha: origen!.fecha,
          proveedor: origen!.proveedor,
          nota: `${etiquetaPase(pase.numero)} desde ${pase.sucursalOrigen?.nombre ?? 'otra sucursal'}`,
          pase: { id: pase.id, entradaOrigenId: origen!.id }
        },
        transaction
      );
    }
    await pase.update(
      { estado: 'recibido', recibidoPorId: ctx.usuarioId, recibidoEn: new Date() },
      { transaction }
    );
  });
  return obtenerPase(ctx, id);
}

/**
 * No se mandó (o se mandó mal): lo que llevaba vuelve a la sucursal origen, a
 * las mismas entradas. Lo puede cancelar cualquiera de las dos sucursales
 * mientras siga en camino.
 */
export async function cancelarPase(ctx: ContextoInventario, id: number) {
  await sequelize.transaction(async (transaction) => {
    const pase = await paseDelTaller(ctx, id, transaction);
    if (pase.estado !== 'en_camino') throw errores.conflicto('El pase ya se recibió o se canceló.');
    for (const item of pase.items ?? []) {
      if (item.equipoStockId) {
        await EquipoStock.update(
          { estado: 'disponible' },
          { where: { id: item.equipoStockId, estado: 'en_camino' }, transaction }
        );
        continue;
      }
      const entrada = await InventarioEntrada.findByPk(item.entradaId!, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      await entrada!.update({ disponible: entrada!.disponible + item.cantidad }, { transaction });
      await registrarMovimiento(
        ctx,
        {
          sucursalId: pase.sucursalOrigenId,
          articuloId: item.articuloId!,
          entradaId: entrada!.id,
          tipo: 'pase_cancelado',
          cantidad: item.cantidad,
          paseId: pase.id,
          nota: 'Pase cancelado'
        },
        transaction
      );
    }
    await pase.update(
      { estado: 'cancelado', canceladoPorId: ctx.usuarioId, canceladoEn: new Date() },
      { transaction }
    );
  });
  return obtenerPase(ctx, id);
}

/** Cuántos pases esperan que esta sucursal confirme que llegaron: para el menú. */
export function pasesPorRecibir(ctx: Pick<ContextoInventario, 'tallerId' | 'sucursalId'>) {
  return Pase.count({
    where: { tallerId: ctx.tallerId, sucursalDestinoId: ctx.sucursalId, estado: 'en_camino' }
  });
}

/** Las sucursales a las que se puede mandar un pase desde la elegida. */
export function sucursalesDestino(ctx: ContextoInventario) {
  return Sucursal.findAll({
    where: { tallerId: ctx.tallerId, activo: true, id: { [Op.ne]: ctx.sucursalId } },
    attributes: ['id', 'nombre'],
    order: [['nombre', 'ASC']]
  });
}
