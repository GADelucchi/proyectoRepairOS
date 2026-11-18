import { Transaction } from 'sequelize';
import {
  Articulo,
  InventarioConsumo,
  InventarioEntrada,
  Orden,
  OrdenServicio,
  ServicioRepuesto,
  Tercerizacion,
  User,
  sequelize
} from '../../models';
import { CONSUMO_CON_COSTO } from '../../models/InventarioConsumo';
import { errores } from '../../shared/http/http-error';
import { aNumero, redondearMonto } from '../../shared/utils/dinero';
import { articuloDelTaller, ultimaCotizacion } from './articulos.service';
import { etiquetaEntrada } from './config';
import { type ContextoInventario, consumir, devolverConsumo, marcarPerdido } from './existencias.service';
import type { AgregarAOrdenInput, DestinoRepuestos } from './inventario.schemas';

/**
 * Agrega a la orden un servicio (y descuenta los repuestos que lleva) o un
 * repuesto suelto. Las unidades salen de la sucursal de la orden, de la
 * entrada más vieja salvo que se elija otra.
 */
export async function agregarAOrden(ctx: ContextoInventario, orden: Orden, datos: AgregarAOrdenInput) {
  await sequelize.transaction(async (transaction) => {
    if (datos.servicioId) {
      const servicio = await articuloDelTaller(ctx.tallerId, datos.servicioId, transaction);
      if (servicio.tipo !== 'servicio') throw errores.solicitudInvalida('Eso no es un servicio.');
      if (!servicio.activo) throw errores.conflicto(`${servicio.nombre} está archivado.`);
      const repuestos = await ServicioRepuesto.findAll({
        where: { servicioId: servicio.id },
        include: [{ model: Articulo, as: 'repuesto' }],
        order: [['id', 'ASC']],
        transaction
      });
      const agregado = await OrdenServicio.create(
        {
          tallerId: ctx.tallerId,
          ordenId: orden.id,
          servicioId: servicio.id,
          nombre: servicio.nombre,
          usuarioId: ctx.usuarioId
        },
        { transaction }
      );
      for (const r of repuestos) {
        await consumir(
          ctx,
          {
            articulo: r.repuesto!,
            sucursalId: orden.sucursalId,
            cantidad: r.cantidad,
            destino: { origen: 'orden', ordenId: orden.id, ordenServicioId: agregado.id },
            nota: servicio.nombre
          },
          transaction
        );
      }
      return;
    }

    const articulo = await articuloDelTaller(ctx.tallerId, datos.articuloId!, transaction);
    if (articulo.tipo === 'servicio')
      throw errores.solicitudInvalida('Para un servicio, elegilo como servicio.');
    await consumir(
      ctx,
      {
        articulo,
        sucursalId: orden.sucursalId,
        cantidad: datos.cantidad,
        entradaPreferida: datos.entradaId,
        destino: { origen: 'orden', ordenId: orden.id }
      },
      transaction
    );
  });
}

async function consumoDeOrden(orden: Orden, consumoId: number, transaction: Transaction) {
  const consumo = await InventarioConsumo.findOne({
    where: { id: consumoId, ordenId: orden.id, origen: 'orden' },
    lock: transaction.LOCK.UPDATE,
    transaction
  });
  if (!consumo) throw errores.noEncontrado('Repuesto');
  return consumo;
}

/** Saca un repuesto de la orden: vuelve a la entrada de la que salió. */
export async function quitarRepuesto(ctx: ContextoInventario, orden: Orden, consumoId: number) {
  await sequelize.transaction(async (transaction) => {
    const consumo = await consumoDeOrden(orden, consumoId, transaction);
    if (consumo.estado !== 'usado') throw errores.conflicto('Ese repuesto ya no está en la orden.');
    await devolverConsumo(ctx, consumo, { nota: 'Se sacó de la orden' }, transaction);
  });
}

/**
 * Saca un servicio de la orden: los repuestos que todavía tenía vuelven al
 * stock. Los que se perdieron siguen siendo costo de la orden.
 */
export async function quitarServicio(ctx: ContextoInventario, orden: Orden, ordenServicioId: number) {
  await sequelize.transaction(async (transaction) => {
    const agregado = await OrdenServicio.findOne({
      where: { id: ordenServicioId, ordenId: orden.id },
      transaction
    });
    if (!agregado) throw errores.noEncontrado('Servicio');
    const consumos = await InventarioConsumo.findAll({
      where: { ordenServicioId: agregado.id, estado: 'usado' },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    for (const consumo of consumos) {
      await devolverConsumo(ctx, consumo, { nota: `Se sacó ${agregado.nombre} de la orden` }, transaction);
    }
    await agregado.destroy({ transaction });
  });
}

/** Se rompió al colocarlo: no vuelve al stock y queda como costo de la orden. */
export async function repuestoPerdido(
  ctx: ContextoInventario,
  orden: Orden,
  consumoId: number,
  motivo: string | null
) {
  await sequelize.transaction(async (transaction) => {
    const consumo = await consumoDeOrden(orden, consumoId, transaction);
    await marcarPerdido(ctx, consumo, motivo, transaction);
  });
}

/**
 * Usar las unidades de otra entrada: las actuales vuelven a la suya y se toman
 * de la elegida (si no alcanza, el resto de la más vieja).
 */
export async function cambiarEntrada(
  ctx: ContextoInventario,
  orden: Orden,
  consumoId: number,
  entradaId: number
) {
  await sequelize.transaction(async (transaction) => {
    const consumo = await consumoDeOrden(orden, consumoId, transaction);
    if (consumo.estado !== 'usado') throw errores.conflicto('Ese repuesto ya no está en la orden.');
    if (consumo.entradaId === entradaId) return;
    const elegida = await InventarioEntrada.findOne({
      where: { id: entradaId, articuloId: consumo.articuloId, sucursalId: consumo.sucursalId },
      transaction
    });
    if (!elegida) throw errores.noEncontrado('Entrada');
    await devolverConsumo(ctx, consumo, { nota: 'Cambio de entrada' }, transaction);
    const articulo = await Articulo.findByPk(consumo.articuloId, { transaction });
    await consumir(
      ctx,
      {
        articulo: articulo!,
        sucursalId: consumo.sucursalId,
        cantidad: consumo.cantidad,
        entradaPreferida: entradaId,
        destino: { origen: 'orden', ordenId: orden.id, ordenServicioId: consumo.ordenServicioId },
        nota: 'Cambio de entrada'
      },
      transaction
    );
  });
}

/** Los repuestos que la orden todavía tiene puestos (ni devueltos ni perdidos). */
export function repuestosEnUso(ordenId: number, transaction?: Transaction) {
  return InventarioConsumo.findAll({
    where: { ordenId, origen: 'orden', estado: 'usado' },
    include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'nombre'] }],
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    transaction
  });
}

/**
 * Al cancelar una orden o dejarla sin reparar, cada repuesto que tenía puesto
 * vuelve al stock o se perdió (y queda como costo). Tiene que decidirse cada uno.
 */
export async function resolverRepuestos(
  ctx: ContextoInventario,
  orden: Orden,
  decisiones: DestinoRepuestos | undefined,
  transaction: Transaction
) {
  const enUso = await repuestosEnUso(orden.id, transaction);
  if (enUso.length === 0) return;
  const faltan = enUso.filter((c) => !decisiones?.some((d) => d.consumoId === c.id));
  if (faltan.length > 0) {
    throw errores.conflicto(
      `La orden tiene repuestos puestos (${faltan.map((c) => c.articulo?.nombre).join(', ')}): indicá si vuelven al stock o se perdieron.`
    );
  }
  for (const consumo of enUso) {
    const decision = decisiones!.find((d) => d.consumoId === consumo.id)!;
    if (decision.destino === 'stock') {
      await devolverConsumo(ctx, consumo, { nota: `Orden ${orden.numeroOrden} sin reparar` }, transaction);
    } else {
      await marcarPerdido(ctx, consumo, decision.motivo ?? null, transaction);
    }
  }
}

const USUARIO = ['id', 'nombre', 'apellido'];

/**
 * Los servicios y repuestos de la orden. Los costos (y de qué entrada salió
 * cada unidad) solo para un admin; para el resto, qué se puso y cuántos.
 */
export async function repuestosDeOrden(orden: Orden, verCostos: boolean) {
  const [servicios, consumos] = await Promise.all([
    OrdenServicio.findAll({
      where: { ordenId: orden.id },
      include: [{ model: User, as: 'usuario', attributes: USUARIO }],
      order: [['id', 'ASC']]
    }),
    InventarioConsumo.findAll({
      where: { ordenId: orden.id, origen: 'orden' },
      include: [
        { model: Articulo, as: 'articulo', attributes: ['id', 'codigo', 'nombre', 'tipo'] },
        {
          model: InventarioEntrada,
          as: 'entrada',
          attributes: ['id', 'numero', 'fecha', 'moneda', 'costo', 'cotizacion']
        },
        { model: User, as: 'usuario', attributes: USUARIO }
      ],
      order: [['id', 'ASC']]
    })
  ]);
  const serializar = (c: InventarioConsumo) => ({
    id: c.id,
    articulo: c.articulo,
    cantidad: c.cantidad,
    estado: c.estado,
    motivo: c.motivo,
    ordenServicioId: c.ordenServicioId,
    usuario: c.usuario,
    createdAt: c.createdAt,
    entrada: c.entrada
      ? {
          id: c.entrada.id,
          etiqueta: etiquetaEntrada(c.entrada.numero),
          fecha: c.entrada.fecha,
          moneda: verCostos ? c.entrada.moneda : null,
          costo: verCostos ? aNumero(c.entrada.costo) : null,
          cotizacion: verCostos && c.entrada.cotizacion != null ? aNumero(c.entrada.cotizacion) : null
        }
      : null,
    costoUsd: verCostos ? redondearMonto(c.cantidad * aNumero(c.costoUsd)) : null
  });
  // Los devueltos ya no están en la orden: se ven en el historial del producto.
  const vigentes = consumos.filter((c) => c.estado !== 'devuelto');
  return {
    servicios: servicios.map((s) => ({
      id: s.id,
      servicioId: s.servicioId,
      nombre: s.nombre,
      usuario: s.usuario,
      createdAt: s.createdAt,
      repuestos: vigentes.filter((c) => c.ordenServicioId === s.id).map(serializar)
    })),
    repuestos: vigentes.filter((c) => !c.ordenServicioId).map(serializar)
  };
}

/** Costo en dólares de los repuestos de cada orden: lo que se usó y lo que se perdió. */
export async function costoDeRepuestos(ordenIds: number[]): Promise<Map<number, number>> {
  if (ordenIds.length === 0) return new Map();
  const consumos = await InventarioConsumo.findAll({
    where: { ordenId: ordenIds, origen: 'orden', estado: CONSUMO_CON_COSTO },
    attributes: ['ordenId', 'cantidad', 'costoUsd', 'estado']
  });
  const costos = new Map<number, number>();
  for (const c of consumos) {
    costos.set(c.ordenId!, (costos.get(c.ordenId!) ?? 0) + c.cantidad * aNumero(c.costoUsd));
  }
  return new Map([...costos].map(([id, total]) => [id, redondearMonto(total)]));
}

/** Lo que se perdió (se rompió al colocarlo) en cada orden, en dólares. */
export async function costoDePerdidos(ordenIds: number[]): Promise<Map<number, number>> {
  if (ordenIds.length === 0) return new Map();
  const consumos = await InventarioConsumo.findAll({
    where: { ordenId: ordenIds, origen: 'orden', estado: 'perdido' },
    attributes: ['ordenId', 'cantidad', 'costoUsd']
  });
  const costos = new Map<number, number>();
  for (const c of consumos) {
    costos.set(c.ordenId!, redondearMonto((costos.get(c.ordenId!) ?? 0) + c.cantidad * aNumero(c.costoUsd)));
  }
  return costos;
}

/** Lo que cobraron los talleres externos por cada orden, en dólares. */
export async function costoDeExternos(ordenIds: number[]): Promise<Map<number, number>> {
  if (ordenIds.length === 0) return new Map();
  const envios = await Tercerizacion.findAll({
    where: { ordenId: ordenIds },
    attributes: ['ordenId', 'costoUsd']
  });
  const costos = new Map<number, number>();
  for (const e of envios) {
    if (e.costoUsd == null) continue;
    costos.set(e.ordenId, redondearMonto((costos.get(e.ordenId) ?? 0) + aNumero(e.costoUsd)));
  }
  return costos;
}

/**
 * Costo y ganancia de una orden, en dólares (solo admin). Hasta que se entrega,
 * contra el presupuesto; después, contra lo que se cobró. Si lo que se compara
 * no es en dólares, con la cotización del cobro o, para un presupuesto, con la
 * última que usó el taller (y lo dice).
 */
export async function costosDeOrden(orden: Orden) {
  const [repuestos, externos, perdidos] = await Promise.all([
    costoDeRepuestos([orden.id]),
    costoDeExternos([orden.id]),
    costoDePerdidos([orden.id])
  ]);
  const repuestosUsd = repuestos.get(orden.id) ?? 0;
  const externoUsd = externos.get(orden.id) ?? 0;
  const entregada = orden.estado === 'entregado';

  const monto = entregada
    ? aNumero(orden.montoTotal)
    : orden.presupuestoMonto == null
      ? null
      : aNumero(orden.presupuestoMonto);
  const moneda = entregada ? (orden.monedaCobro ?? orden.moneda) : orden.moneda;
  let cotizacion: number | null = null;
  let cotizacionEstimada = false;
  if (moneda !== 'USD') {
    if (entregada && orden.cotizacionCobro != null) cotizacion = aNumero(orden.cotizacionCobro);
    else if (!entregada) {
      cotizacion = await ultimaCotizacion(orden.tallerId, moneda);
      cotizacionEstimada = cotizacion !== null;
    }
  }
  const baseUsd =
    monto === null ? null : moneda === 'USD' ? monto : cotizacion ? redondearMonto(monto / cotizacion) : null;
  const gananciaUsd = baseUsd === null ? null : redondearMonto(baseUsd - repuestosUsd - externoUsd);

  return {
    base: entregada ? 'cobrado' : 'presupuesto',
    monto,
    moneda,
    cotizacion,
    cotizacionEstimada,
    /** Falta la cotización del cobro: un admin la puede cargar. */
    faltaCotizacion: entregada && moneda !== 'USD' && cotizacion === null,
    baseUsd,
    repuestosUsd,
    perdidosUsd: perdidos.get(orden.id) ?? 0,
    externoUsd,
    gananciaUsd,
    margen: gananciaUsd !== null && baseUsd ? redondearMonto((gananciaUsd / baseUsd) * 100) : null
  };
}
