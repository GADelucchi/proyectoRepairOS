import { Op, Transaction, WhereOptions } from 'sequelize';
import { z } from 'zod';
import { env } from '../../config/env';
import {
  Cliente,
  Contador,
  EquipoStock,
  Sucursal,
  Taller,
  User,
  Venta,
  VentaItem,
  VentaPago,
  VentaPartePago,
  sequelize
} from '../../models';
import type { MedioPago } from '../../models/CuentaMovimiento';
import type { EstadoStock } from '../../models/EquipoStock';
import type { EstadoVenta, VentaAttributes } from '../../models/Venta';
import type { TipoPagoVenta } from '../../models/VentaPago';
import { errores } from '../../shared/http/http-error';
import { type Moneda, aNumero, redondearMonto } from '../../shared/utils/dinero';
import { fechaEnZona } from '../../shared/utils/fechas';
import { nombreCompleto } from '../../shared/utils/texto';
import {
  ContextoStock,
  PROVEEDOR_PARTE_DE_PAGO,
  etiquetaNumero,
  exigirSinRepetidos,
  ingresarAlStock,
  serializarEquipoStock
} from '../stock/stock.service';
import {
  equivalenteDe,
  etiquetaVenta,
  mismoMonto,
  problemaDePago,
  problemaDeTotales,
  totalesDeVenta
} from './calculos';
import { revisarVencimientos } from './vencimientos.service';
import {
  NuevaVenta,
  PagoVentaInput,
  PartePagoInput,
  anularVentaSchema,
  cancelarVentaSchema,
  listarVentasQuery,
  pagarVentaSchema
} from './ventas.schemas';

/** Quién vende: desde la sucursal elegida. */
export type ContextoVenta = ContextoStock;

const LIMITE_LISTADO = 200;
const USUARIO_RESUMIDO = ['id', 'nombre', 'apellido'];
const CLIENTE = [
  'id',
  'nombre',
  'apellido',
  'dniCuit',
  'condicionIva',
  'telefono',
  'email',
  'direccion',
  'ciudad',
  'esGremio',
  'nombreGremio'
];

const INCLUDES_DETALLE = [
  { model: Cliente, as: 'cliente', attributes: CLIENTE },
  { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre', 'direccion', 'telefono'] },
  { model: User, as: 'vendedor', attributes: USUARIO_RESUMIDO },
  { model: User, as: 'canceladaPor', attributes: USUARIO_RESUMIDO },
  { model: VentaItem, as: 'items', include: [{ model: EquipoStock, as: 'equipo' }] },
  { model: VentaPartePago, as: 'partesPago' },
  { model: VentaPago, as: 'pagos', include: [{ model: User, as: 'usuario', attributes: USUARIO_RESUMIDO }] }
];

/** Lo que entró en plata, en la moneda de la venta: señas y pagos, menos lo que se devolvió. */
function pagadoDe(pagos: Pick<VentaPago, 'tipo' | 'equivalente'>[]): number {
  return redondearMonto(
    pagos.reduce((total, p) => total + (p.tipo === 'devolucion' ? -1 : 1) * aNumero(p.equivalente), 0)
  );
}

/** Un pago listo para guardar: en su moneda y con lo que cubre de la venta. */
interface PagoImputado {
  monto: number;
  moneda: Moneda;
  cotizacion: number | null;
  equivalente: number;
  medioPago: MedioPago;
}

/** Cada pago con lo que cubre de la venta. Uno en otra moneda necesita la cotización. */
function imputarPagos(pagos: PagoVentaInput[], monedaVenta: Moneda): PagoImputado[] {
  return pagos.map((p) => {
    const moneda = p.moneda ?? monedaVenta;
    const pago = {
      monto: p.monto,
      moneda,
      cotizacion: moneda === monedaVenta ? null : (p.cotizacion ?? null)
    };
    const problema = problemaDePago(pago, monedaVenta);
    if (problema) throw errores.solicitudInvalida(problema);
    return { ...pago, medioPago: p.medioPago, equivalente: equivalenteDe(pago, monedaVenta) };
  });
}

/** Ya no espera pagos: se cerró sin completarse o se dio vuelta. */
const CERRADAS: EstadoVenta[] = ['cancelada', 'vencida', 'anulada'];

/** Lo que falta pagar en plata: el total, menos la parte de pago, menos lo que ya pagó. */
function saldoDe(venta: Venta, pagado: number): number {
  if (CERRADAS.includes(venta.estado)) return 0;
  return redondearMonto(aNumero(venta.total) - aNumero(venta.partePago) - pagado);
}

/** Una venta tal como sale por la API. El costo de los equipos solo lo ve un admin. */
export function serializarVenta(venta: Venta, verCostos: boolean) {
  const pagado = pagadoDe(venta.pagos ?? []);
  const datos = venta.get({ plain: true });
  return {
    ...datos,
    etiqueta: etiquetaVenta(venta.numero),
    pagado,
    saldo: saldoDe(venta, pagado),
    items: (venta.items ?? []).map((item) => ({
      ...item.get({ plain: true }),
      equipo: item.equipo ? serializarEquipoStock(item.equipo, verCostos) : null
    }))
  };
}

/**
 * Una venta del taller. La de otra sucursal la ve solo un admin; si no,
 * responde 404 como cualquier id ajeno.
 */
export async function ventaVisible(ctx: ContextoVenta, id: number, transaction?: Transaction) {
  const venta = await Venta.findOne({
    where: { id, tallerId: ctx.tallerId },
    include: INCLUDES_DETALLE,
    order: [
      [{ model: VentaItem, as: 'items' }, 'id', 'ASC'],
      [{ model: VentaPago, as: 'pagos' }, 'id', 'ASC']
    ],
    transaction
  });
  if (!venta || (venta.sucursalId !== ctx.sucursalId && !ctx.esAdmin)) throw errores.noEncontrado('Venta');
  return venta;
}

async function detalle(ctx: ContextoVenta, id: number) {
  return serializarVenta(await ventaVisible(ctx, id), ctx.esAdmin);
}

async function resolverCliente(ctx: ContextoVenta, datos: NuevaVenta, transaction: Transaction) {
  if (datos.clienteId) {
    const existe = await Cliente.count({
      where: { id: datos.clienteId, tallerId: ctx.tallerId },
      transaction
    });
    if (!existe) throw errores.noEncontrado('Cliente');
    return datos.clienteId;
  }
  const nuevo = datos.nuevoCliente!;
  if (nuevo.cuentaCorrienteHabilitada && !ctx.esAdmin) {
    throw errores.sinPermiso('Solo un administrador puede habilitar la cuenta corriente de un cliente');
  }
  return (await Cliente.create({ ...nuevo, tallerId: ctx.tallerId }, { transaction })).id;
}

/**
 * Los equipos que se venden, bloqueados hasta el final de la transacción: dos
 * mostradores no pueden vender el mismo equipo a la vez.
 */
async function equiposParaVender(ctx: ContextoVenta, ids: number[], transaction: Transaction) {
  const equipos = await EquipoStock.findAll({
    where: { id: ids, tallerId: ctx.tallerId },
    lock: transaction.LOCK.UPDATE,
    transaction
  });
  if (equipos.length !== ids.length) throw errores.noEncontrado('Equipo');

  const compartido = equipos.some((e) => e.sucursalId !== ctx.sucursalId)
    ? Boolean(
        (await Taller.findByPk(ctx.tallerId, { attributes: ['stockEntreSucursales'], transaction }))
          ?.stockEntreSucursales
      )
    : true;
  for (const equipo of equipos) {
    if (equipo.sucursalId !== ctx.sucursalId && !compartido) throw errores.noEncontrado('Equipo');
    if (equipo.estado !== 'disponible') {
      throw errores.conflicto(
        `${etiquetaNumero(equipo.numero)} (${equipo.marca} ${equipo.modelo}) no está disponible: ya está apartado, vendido o dado de baja.`
      );
    }
  }
  return equipos;
}

async function cambiarEstadoEquipos(
  venta: Venta,
  estado: EstadoStock,
  transaction: Transaction,
  desde?: EstadoStock[]
) {
  const ids = (
    await VentaItem.findAll({ where: { ventaId: venta.id }, attributes: ['equipoStockId'], transaction })
  ).map((i) => i.equipoStockId);
  await EquipoStock.update(
    { estado },
    { where: { id: ids, ...(desde ? { estado: desde } : {}) }, transaction }
  );
}

/** Los equipos que dejó el cliente entran al stock al completar la venta, con lo que se le tomó como costo. */
async function ingresarPartesPago(ctx: ContextoVenta, venta: Venta, transaction: Transaction) {
  const partes = await VentaPartePago.findAll({
    where: { ventaId: venta.id, equipoStockId: null },
    transaction
  });
  const hoy = fechaEnZona(new Date(), env.timezone);
  for (const parte of partes) {
    const equipo = await ingresarAlStock(
      ctx,
      {
        marca: parte.marca,
        modelo: parte.modelo,
        color: parte.color,
        almacenamientoGb: parte.almacenamientoGb,
        condicion: parte.condicion,
        bateria: parte.bateria,
        numeroSerie: parte.numeroSerie,
        imei: parte.imei,
        imei2: parte.imei2,
        fechaCompra: hoy,
        proveedor: PROVEEDOR_PARTE_DE_PAGO,
        monedaCosto: venta.moneda,
        costo: parte.monto,
        cotizacionCosto: venta.cotizacion,
        observaciones: [`Lo dejó el cliente en ${etiquetaVenta(venta.numero)}.`, parte.observaciones]
          .filter(Boolean)
          .join(' '),
        recibidoEnVentaId: venta.id
      },
      transaction
    );
    await parte.update({ equipoStockId: equipo.id }, { transaction });
  }
}

async function registrarPagos(
  ctx: ContextoVenta,
  venta: Venta,
  tipo: TipoPagoVenta,
  pagos: PagoImputado[],
  transaction: Transaction
) {
  if (pagos.length === 0) return;
  await VentaPago.bulkCreate(
    pagos.map((p) => ({
      tallerId: ctx.tallerId,
      sucursalId: ctx.sucursalId,
      ventaId: venta.id,
      tipo,
      monto: p.monto.toFixed(2),
      moneda: p.moneda,
      cotizacion: p.cotizacion?.toFixed(4) ?? null,
      equivalente: p.equivalente.toFixed(2),
      medioPago: p.medioPago,
      usuarioId: ctx.usuarioId
    })),
    { transaction }
  );
}

/** Lo que cubren los pagos, en la moneda de la venta. */
const sumaDe = (pagos: PagoImputado[]) => redondearMonto(pagos.reduce((t, p) => t + p.equivalente, 0));

const ESTADO_INICIAL: Record<NuevaVenta['modo'], { venta: EstadoVenta; equipo: EstadoStock }> = {
  venta: { venta: 'completada', equipo: 'vendido' },
  sena: { venta: 'senada', equipo: 'senado' },
  reserva: { venta: 'reservada', equipo: 'reservado' }
};

/**
 * Alta de una venta, en una sola transacción: el cliente (si es nuevo), los
 * equipos (bloqueados para que nadie más los venda), lo que deja en parte de
 * pago, la plata que entra y el número.
 *
 * - `venta`: paga todo y se lleva los equipos. Lo que deja entra al stock.
 * - `sena`: paga una parte; los equipos quedan apartados como señados.
 * - `reserva`: no paga nada; los equipos quedan apartados hasta `reservadaHasta`.
 */
export async function crearVenta(ctx: ContextoVenta, datos: NuevaVenta) {
  // Una reserva vencida libera sus equipos antes de intentar venderlos.
  await revisarVencimientos(ctx.tallerId);

  const totales = totalesDeVenta(
    datos.items.map((i) => i.precio),
    datos.descuento,
    datos.partesPago.map((p) => p.monto)
  );
  const problema = problemaDeTotales(totales);
  if (problema) throw errores.solicitudInvalida(problema);

  const pagos = imputarPagos(datos.pagos, datos.moneda);
  const pagado = sumaDe(pagos);
  if (datos.modo === 'venta' && !mismoMonto(pagado, totales.aPagar)) {
    throw errores.solicitudInvalida(
      `Para entregar los equipos tiene que pagar todo: faltan ${redondearMonto(totales.aPagar - pagado)}. Si deja una parte, es una seña.`
    );
  }
  if (datos.modo === 'sena' && pagado >= totales.aPagar - 0.005) {
    throw errores.solicitudInvalida('La seña cubre todo el saldo: registrala como venta.');
  }
  const hoy = fechaEnZona(new Date(), env.timezone);
  if (datos.modo === 'reserva' && datos.reservadaHasta! < hoy) {
    throw errores.solicitudInvalida('La reserva tiene que ser hasta hoy o una fecha posterior.');
  }

  const estados = ESTADO_INICIAL[datos.modo];
  const id = await sequelize.transaction(async (transaction) => {
    const clienteId = await resolverCliente(ctx, datos, transaction);
    await equiposParaVender(
      ctx,
      datos.items.map((i) => i.equipoStockId),
      transaction
    );
    // Un equipo que deja el cliente y ya está en el stock es un error de carga: mejor saberlo ahora.
    for (const parte of datos.partesPago) await exigirSinRepetidos(ctx.tallerId, parte, { transaction });

    const numero = await Contador.reservarSiguiente(`venta:${ctx.tallerId}`, transaction);
    const venta = await Venta.create(
      {
        tallerId: ctx.tallerId,
        sucursalId: ctx.sucursalId,
        numero,
        clienteId,
        estado: estados.venta,
        moneda: datos.moneda,
        cotizacion: datos.cotizacion?.toFixed(4) ?? null,
        subtotal: totales.subtotal.toFixed(2),
        descuentoTipo: datos.descuento?.tipo ?? null,
        descuentoValor: datos.descuento?.valor.toFixed(2) ?? null,
        descuento: totales.descuento.toFixed(2),
        total: totales.total.toFixed(2),
        partePago: totales.partePago.toFixed(2),
        reservadaHasta: datos.reservadaHasta,
        comentarioCliente: datos.comentarioCliente,
        comentarioInterno: datos.comentarioInterno,
        vendedorId: ctx.usuarioId,
        completadaEn: datos.modo === 'venta' ? new Date() : null
      },
      { transaction }
    );

    await VentaItem.bulkCreate(
      datos.items.map((i) => ({
        ventaId: venta.id,
        equipoStockId: i.equipoStockId,
        precio: i.precio.toFixed(2)
      })),
      { transaction }
    );
    await VentaPartePago.bulkCreate(
      datos.partesPago.map((p: PartePagoInput) => ({ ...p, ventaId: venta.id, monto: p.monto.toFixed(2) })),
      { transaction }
    );
    await registrarPagos(ctx, venta, datos.modo === 'venta' ? 'pago' : 'sena', pagos, transaction);
    await cambiarEstadoEquipos(venta, estados.equipo, transaction);
    if (datos.modo === 'venta') await ingresarPartesPago(ctx, venta, transaction);
    return venta.id;
  });

  return detalle(ctx, id);
}

/** La venta bloqueada, para cambiarla sin que otro mostrador la cambie a la vez. */
async function bloquearVenta(venta: Venta, transaction: Transaction) {
  const bloqueada = await Venta.findByPk(venta.id, { lock: transaction.LOCK.UPDATE, transaction });
  if (!bloqueada) throw errores.noEncontrado('Venta');
  return bloqueada;
}

function exigirAbierta(venta: Venta) {
  if (venta.estado === 'reservada' || venta.estado === 'senada') return;
  const motivo: Partial<Record<EstadoVenta, string>> = {
    completada: 'La venta ya está completa.',
    cancelada: 'La venta está cancelada.',
    anulada: 'La venta está anulada.',
    vencida: 'La reserva venció y los equipos volvieron al stock. Hacé una venta nueva.'
  };
  throw errores.conflicto(motivo[venta.estado] ?? 'La venta no admite cambios.');
}

/**
 * Pagar sobre una reserva o una seña. Si cubre el saldo, la venta se completa:
 * los equipos pasan a vendidos y lo que dejó el cliente entra al stock. Si no,
 * queda señada (una reserva que recibe plata deja de vencer).
 */
export async function pagarVenta(
  ctx: ContextoVenta,
  venta: Venta,
  { pagos }: z.infer<typeof pagarVentaSchema>
) {
  await revisarVencimientos(ctx.tallerId);
  await sequelize.transaction(async (transaction) => {
    const actual = await bloquearVenta(venta, transaction);
    exigirAbierta(actual);
    const anteriores = await VentaPago.findAll({ where: { ventaId: actual.id }, transaction });
    const saldo = saldoDe(actual, pagadoDe(anteriores));
    const imputados = imputarPagos(pagos, actual.moneda);
    const monto = sumaDe(imputados);

    if (monto > saldo + 0.005)
      throw errores.solicitudInvalida(`El pago supera el saldo de la venta (${saldo}).`);
    if (monto <= 0 && saldo > 0) throw errores.solicitudInvalida('Indicá cuánto paga.');

    const completa = mismoMonto(monto, saldo);
    await registrarPagos(ctx, actual, completa ? 'pago' : 'sena', imputados, transaction);
    if (completa) {
      await actual.update({ estado: 'completada', completadaEn: new Date() }, { transaction });
      await cambiarEstadoEquipos(actual, 'vendido', transaction);
      await ingresarPartesPago(ctx, actual, transaction);
    } else {
      await actual.update({ estado: 'senada', reservadaHasta: null }, { transaction });
      await cambiarEstadoEquipos(actual, 'senado', transaction);
    }
  });
  return detalle(ctx, venta.id);
}

/** Más días de reserva. Solo para una reserva sin pago: una seña no vence. */
export async function extenderReserva(ctx: ContextoVenta, venta: Venta, hasta: string) {
  if (venta.estado !== 'reservada') throw errores.conflicto('Solo se extiende una reserva sin pago.');
  if (hasta < fechaEnZona(new Date(), env.timezone)) {
    throw errores.solicitudInvalida('La reserva tiene que ser hasta hoy o una fecha posterior.');
  }
  await venta.update({ reservadaHasta: hasta });
  return detalle(ctx, venta.id);
}

/**
 * Lo común a cancelar y anular: la plata que se devuelve (sale de la caja hoy,
 * en las monedas en que entró), los equipos que vuelven al stock y quién, cuándo
 * y por qué la cerró.
 */
async function cerrarVenta(
  ctx: ContextoVenta,
  venta: Venta,
  estado: 'cancelada' | 'anulada',
  { motivo, devolver, medio }: { motivo: string; devolver: boolean; medio: MedioPago },
  transaction: Transaction
) {
  const pagos = await VentaPago.findAll({ where: { ventaId: venta.id }, transaction });
  if (devolver && pagadoDe(pagos) > 0) {
    await registrarPagos(ctx, venta, 'devolucion', devolucionDe(pagos, venta.moneda, medio), transaction);
  }
  const apartados: EstadoStock[] = estado === 'anulada' ? ['vendido'] : ['reservado', 'senado'];
  await cambiarEstadoEquipos(venta, 'disponible', transaction, apartados);
  await venta.update(
    { estado, canceladaEn: new Date(), canceladaPorId: ctx.usuarioId, motivoCancelacion: motivo },
    { transaction }
  );
}

/**
 * Cancelar una reserva o una seña (solo admin). La venta no se borra: queda
 * cancelada con quién, cuándo y por qué, y los equipos vuelven al stock. La
 * seña se devuelve (sale de la caja) o se la queda el taller.
 *
 * Una venta completada no se cancela: se anula.
 */
export async function cancelarVenta(
  ctx: ContextoVenta,
  venta: Venta,
  { motivo, devolverSena, medioDevolucion }: z.infer<typeof cancelarVentaSchema>
) {
  await sequelize.transaction(async (transaction) => {
    const actual = await bloquearVenta(venta, transaction);
    if (actual.estado === 'completada') {
      throw errores.conflicto('Una venta completada no se cancela: se anula.');
    }
    exigirAbierta(actual);
    await cerrarVenta(
      ctx,
      actual,
      'cancelada',
      { motivo, devolver: devolverSena, medio: medioDevolucion },
      transaction
    );
  });
  return detalle(ctx, venta.id);
}

/**
 * Anular una venta completada (solo admin): un error de carga o un cliente que
 * devuelve lo que se llevó. Tampoco se borra: queda anulada con quién, cuándo y
 * por qué, y deja de contar en el informe. Los equipos vuelven al stock, lo que
 * dejó en parte de pago se le devuelve y lo que pagó se le devuelve o se lo
 * queda el taller.
 */
export async function anularVenta(
  ctx: ContextoVenta,
  venta: Venta,
  { motivo, devolverPlata, medioDevolucion }: z.infer<typeof anularVentaSchema>
) {
  await sequelize.transaction(async (transaction) => {
    const actual = await bloquearVenta(venta, transaction);
    if (actual.estado !== 'completada') {
      throw errores.conflicto(
        actual.estado === 'anulada'
          ? 'La venta ya está anulada.'
          : 'Solo se anula una venta completada: una reserva o una seña se cancela.'
      );
    }
    await devolverPartesPago(ctx, actual, transaction);
    await cerrarVenta(
      ctx,
      actual,
      'anulada',
      { motivo, devolver: devolverPlata, medio: medioDevolucion },
      transaction
    );
  });
  return detalle(ctx, venta.id);
}

/**
 * Lo que dejó el cliente en parte de pago vuelve a sus manos: sale del stock
 * dado de baja, con el motivo. Si ya está en otra venta o se dio de baja, no se
 * le puede devolver y la anulación no sigue.
 */
async function devolverPartesPago(ctx: ContextoVenta, venta: Venta, transaction: Transaction) {
  const ids = (
    await VentaPartePago.findAll({
      where: { ventaId: venta.id, equipoStockId: { [Op.ne]: null } },
      attributes: ['equipoStockId'],
      transaction
    })
  ).map((p) => p.equipoStockId!);
  if (ids.length === 0) return;

  const equipos = await EquipoStock.findAll({
    where: { id: ids },
    lock: transaction.LOCK.UPDATE,
    transaction
  });
  const ocupado = equipos.find((e) => e.estado !== 'disponible');
  if (ocupado) {
    const cual = `${etiquetaNumero(ocupado.numero)} (${ocupado.marca} ${ocupado.modelo}), que dejó el cliente,`;
    throw errores.conflicto(
      ocupado.estado === 'baja'
        ? `${cual} se dio de baja del stock: no se le puede devolver.`
        : `${cual} está en otra venta: cancelá o anulá esa primero.`
    );
  }
  await EquipoStock.update(
    {
      estado: 'baja',
      bajaEn: new Date(),
      bajaPorId: ctx.usuarioId,
      motivoBaja: `Se le devolvió al cliente al anular ${etiquetaVenta(venta.numero)}.`
    },
    { where: { id: ids }, transaction }
  );
}

/**
 * Lo que se devuelve al cancelar: lo mismo que entró, en cada moneda. Si dejó
 * dólares y pesos, se le devuelven dólares y pesos.
 */
function devolucionDe(pagos: VentaPago[], monedaVenta: Moneda, medioPago: MedioPago): PagoImputado[] {
  const porMoneda = new Map<Moneda, { monto: number; equivalente: number }>();
  for (const p of pagos) {
    const signo = p.tipo === 'devolucion' ? -1 : 1;
    const suma = porMoneda.get(p.moneda) ?? { monto: 0, equivalente: 0 };
    suma.monto += signo * aNumero(p.monto);
    suma.equivalente += signo * aNumero(p.equivalente);
    porMoneda.set(p.moneda, suma);
  }
  return [...porMoneda.entries()]
    .filter(([, suma]) => suma.monto > 0.005)
    .map(([moneda, suma]) => {
      const equivalente = redondearMonto(suma.equivalente);
      const monto = redondearMonto(suma.monto);
      // La cotización promedio de lo que entró en esa moneda, siempre como 1 US$ en la otra.
      const cotizacion =
        moneda === monedaVenta
          ? null
          : Number((moneda === 'USD' ? equivalente / monto : monto / equivalente).toFixed(4));
      return { moneda, monto, equivalente, cotizacion, medioPago };
    });
}

/** Listado de ventas de la sucursal (o de todas, para un admin), las más nuevas primero. */
export async function listarVentas(ctx: ContextoVenta, filtros: z.infer<typeof listarVentasQuery>) {
  await revisarVencimientos(ctx.tallerId);
  const todas = ctx.esAdmin && filtros.todasLasSucursales;
  const { search } = filtros;
  const numero = search && /^(vta-?)?\d{1,9}$/i.test(search) ? Number(search.replace(/\D/g, '')) : null;
  const digitos = search?.replace(/\D/g, '');

  // Búsqueda por IMEI o serial de un equipo de la venta: primero los ids, así el listado no duplica filas.
  let porEquipo: number[] = [];
  if (search) {
    const items = await VentaItem.findAll({
      attributes: ['ventaId'],
      include: [
        {
          model: EquipoStock,
          as: 'equipo',
          attributes: [],
          where: {
            tallerId: ctx.tallerId,
            [Op.or]: [
              { numeroSerie: search },
              ...(digitos && digitos.length >= 6 ? [{ imei: { [Op.like]: `%${digitos}%` } }] : [])
            ]
          }
        }
      ]
    });
    porEquipo = items.map((i) => i.ventaId);
  }

  const where: WhereOptions<VentaAttributes> = {
    tallerId: ctx.tallerId,
    ...(todas ? {} : { sucursalId: ctx.sucursalId }),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(search
      ? {
          [Op.or]: [
            ...['nombre', 'apellido', 'dni_cuit'].map((campo) => ({
              [`$cliente.${campo}$`]: { [Op.like]: `%${search}%` }
            })),
            ...(numero ? [{ numero }] : []),
            ...(porEquipo.length ? [{ id: porEquipo }] : [])
          ]
        }
      : {})
  };

  // Primero los ids (el límite cuenta ventas, no filas del join), después cada venta con sus equipos y pagos.
  const ids = (
    await Venta.findAll({
      where,
      attributes: ['id'],
      include: [{ model: Cliente, as: 'cliente', attributes: [] }],
      order: [['id', 'DESC']],
      limit: LIMITE_LISTADO,
      raw: true
    })
  ).map((v) => v.id);

  const ventas = await Venta.findAll({
    where: { id: ids },
    include: [
      { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido', 'telefono'] },
      { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
      { model: User, as: 'vendedor', attributes: USUARIO_RESUMIDO },
      {
        model: VentaItem,
        as: 'items',
        attributes: ['id', 'precio', 'equipoStockId'],
        include: [
          {
            model: EquipoStock,
            as: 'equipo',
            attributes: [
              'id',
              'numero',
              'marca',
              'modelo',
              'color',
              'almacenamientoGb',
              'condicion',
              'bateria'
            ]
          }
        ]
      },
      { model: VentaPago, as: 'pagos', attributes: ['id', 'tipo', 'equivalente', 'createdAt'] }
    ],
    order: [['id', 'DESC']]
  });

  return ventas.map((venta) => {
    const pagado = pagadoDe(venta.pagos ?? []);
    const primeraSena = Math.min(
      ...(venta.pagos ?? []).filter((p) => p.tipo === 'sena').map((p) => p.createdAt.getTime())
    );
    return {
      id: venta.id,
      numero: venta.numero,
      etiqueta: etiquetaVenta(venta.numero),
      estado: venta.estado,
      cliente: venta.cliente,
      sucursal: venta.sucursal,
      vendedor: venta.vendedor ? nombreCompleto(venta.vendedor) : null,
      moneda: venta.moneda,
      total: venta.total,
      partePago: venta.partePago,
      pagado,
      saldo: saldoDe(venta, pagado),
      reservadaHasta: venta.reservadaHasta,
      senadaDesde: Number.isFinite(primeraSena) ? new Date(primeraSena) : null,
      createdAt: venta.createdAt,
      completadaEn: venta.completadaEn,
      equipos: (venta.items ?? []).map((i) => i.equipo)
    };
  });
}
