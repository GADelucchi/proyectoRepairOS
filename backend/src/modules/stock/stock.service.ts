import { Op, Transaction, WhereOptions, col, fn, literal } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../../config/database';
import { env } from '../../config/env';
import {
  Contador,
  EquipoStock,
  EquipoStockCosto,
  Sucursal,
  Taller,
  User,
  Venta,
  VentaItem
} from '../../models';
import { EquipoStockAttributes, EquipoStockCreationAttributes, EstadoStock } from '../../models/EquipoStock';
import { errores } from '../../shared/http/http-error';
import { aNumero, enDolares, redondearMonto } from '../../shared/utils/dinero';
import { fechaEnZona } from '../../shared/utils/fechas';
import { etiquetaVenta } from '../ventas/calculos';
import { CostoReparacionInput, EquipoStockInput, listarStockQuery } from './stock.schemas';

/** Quién opera: el stock se carga y se ve desde la sucursal elegida. Los costos los ve solo un admin. */
export interface ContextoStock {
  tallerId: number;
  sucursalId: number;
  usuarioId: number;
  esAdmin: boolean;
}

/** Lo que ya no está en el stock: no cuenta para el valor ni para los repetidos. */
const FUERA_DEL_STOCK: EstadoStock[] = ['vendido', 'baja'];

const LIMITE_LISTADO = 200;

/** El "proveedor" de lo que entra en parte de pago: no es alguien a quien se le compra. */
export const PROVEEDOR_PARTE_DE_PAGO = 'Parte de pago';

const LIMITE_PROVEEDORES = 100;

const INCLUDES = [
  { model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] },
  { model: User, as: 'bajaPor', attributes: ['id', 'nombre', 'apellido'] }
];

/** #0042: el número con el que se nombra al equipo en el mostrador. */
export const etiquetaNumero = (numero: number) => `#${String(numero).padStart(4, '0')}`;

/**
 * Lo que costó el equipo en dólares: la compra, con la cotización de ese día,
 * más lo que se le agregó después (reparaciones, repuestos). Es el costo que
 * resta en el informe de ventas.
 */
export function costoTotalUsd(
  equipo: Pick<EquipoStock, 'costo' | 'monedaCosto' | 'cotizacionCosto' | 'costoReparacionesUsd'>
): number {
  return redondearMonto(
    enDolares(equipo.costo, equipo.monedaCosto, equipo.cotizacionCosto) + aNumero(equipo.costoReparacionesUsd)
  );
}

/**
 * Equipo tal como sale por la API, con el costo ya pasado a dólares para sumar:
 * `costoCompraUsd` es lo que se pagó, `costoUsd` incluye las reparaciones.
 * Sin `verCostos` (quien no es admin), ningún costo sale del servidor.
 */
export function serializarEquipoStock(equipo: EquipoStock, verCostos: boolean) {
  const datos = equipo.get({ plain: true });
  if (!verCostos) {
    return {
      ...datos,
      costo: null,
      cotizacionCosto: null,
      costoReparacionesUsd: null,
      costoCompraUsd: null,
      costoUsd: null
    };
  }
  return {
    ...datos,
    costoCompraUsd: enDolares(equipo.costo, equipo.monedaCosto, equipo.cotizacionCosto),
    costoReparacionesUsd: aNumero(equipo.costoReparacionesUsd),
    costoUsd: costoTotalUsd(equipo)
  };
}

/**
 * La venta en la que está cada equipo apartado o vendido: para mostrar a quién,
 * cuándo y a cuánto. Las canceladas y vencidas no cuentan (el equipo volvió).
 */
async function ventasDe(equipos: EquipoStock[]) {
  const ids = equipos.filter((e) => e.estado !== 'disponible' && e.estado !== 'baja').map((e) => e.id);
  if (ids.length === 0) return new Map<number, Record<string, unknown>>();
  const items = await VentaItem.findAll({
    where: { equipoStockId: ids },
    attributes: ['equipoStockId', 'precio'],
    include: [
      {
        model: Venta,
        as: 'venta',
        required: true,
        where: { estado: ['reservada', 'senada', 'completada'] },
        attributes: ['id', 'numero', 'estado', 'moneda', 'createdAt', 'completadaEn']
      }
    ]
  });
  return new Map(
    items.map((i) => [
      i.equipoStockId,
      {
        id: i.venta!.id,
        etiqueta: etiquetaVenta(i.venta!.numero),
        estado: i.venta!.estado,
        precio: i.precio,
        moneda: i.venta!.moneda,
        fecha: i.venta!.completadaEn ?? i.venta!.createdAt
      }
    ])
  );
}

/** Con la venta de cada uno, si está apartado o vendido. */
export async function serializarConVenta(equipos: EquipoStock[], verCostos: boolean) {
  const ventas = await ventasDe(equipos);
  return equipos.map((e) => ({ ...serializarEquipoStock(e, verCostos), venta: ventas.get(e.id) ?? null }));
}

async function veOtrasSucursales(tallerId: number): Promise<boolean> {
  const taller = await Taller.findByPk(tallerId, { attributes: ['stockEntreSucursales'] });
  return Boolean(taller?.stockEntreSucursales);
}

/**
 * Qué sucursal mira el listado. Sin indicar, la elegida; otra (o todas) solo si
 * el taller lo habilitó. `null` es todas.
 */
async function sucursalDelFiltro(ctx: ContextoStock, pedida?: 'todas' | number): Promise<number | null> {
  if (pedida === undefined || pedida === ctx.sucursalId) return ctx.sucursalId;
  if (!(await veOtrasSucursales(ctx.tallerId))) {
    throw errores.sinPermiso('Para ver el stock de otras sucursales, habilitalo en Configuración.');
  }
  if (pedida === 'todas') return null;
  if (!(await Sucursal.count({ where: { id: pedida, tallerId: ctx.tallerId } }))) {
    throw errores.noEncontrado('Sucursal');
  }
  return pedida;
}

/**
 * Un equipo del stock del taller. El de otra sucursal se ve solo si el taller
 * comparte el stock; si no, responde 404 como cualquier id ajeno.
 */
export async function equipoVisible(ctx: ContextoStock, id: number): Promise<EquipoStock> {
  const equipo = await EquipoStock.findOne({ where: { id, tallerId: ctx.tallerId }, include: INCLUDES });
  if (!equipo) throw errores.noEncontrado('Equipo');
  if (equipo.sucursalId !== ctx.sucursalId && !(await veOtrasSucursales(ctx.tallerId))) {
    throw errores.noEncontrado('Equipo');
  }
  return equipo;
}

type Identificacion = Pick<EquipoStockInput, 'imei' | 'imei2' | 'numeroSerie'>;

/**
 * El equipo del stock que ya tiene alguno de estos IMEI o este serial. Se
 * compara solo con lo que sigue en el stock: un equipo vendido puede volver (en
 * parte de pago, por ejemplo).
 */
export async function buscarRepetido(
  tallerId: number,
  datos: Identificacion,
  { excluirId, transaction }: { excluirId?: number; transaction?: Transaction } = {}
) {
  const imeis = [datos.imei, datos.imei2].filter((v): v is string => Boolean(v));
  const condiciones: WhereOptions<EquipoStockAttributes>[] = [
    ...imeis.flatMap((imei) => [{ imei }, { imei2: imei }]),
    ...(datos.numeroSerie ? [{ numeroSerie: datos.numeroSerie }] : [])
  ];
  if (condiciones.length === 0) return null;

  return EquipoStock.findOne({
    where: {
      tallerId,
      estado: { [Op.notIn]: FUERA_DEL_STOCK },
      [Op.or]: condiciones,
      ...(excluirId ? { id: { [Op.ne]: excluirId } } : {})
    },
    attributes: ['id', 'numero', 'marca', 'modelo', 'estado', 'sucursalId'],
    transaction
  });
}

/** Un IMEI o un serial no puede estar dos veces en el stock. */
export async function exigirSinRepetidos(
  tallerId: number,
  datos: Identificacion,
  opciones: { excluirId?: number; transaction?: Transaction } = {}
) {
  const otro = await buscarRepetido(tallerId, datos, opciones);
  if (otro) {
    throw errores.conflicto(
      `Ese IMEI o número de serie ya está en el stock: ${etiquetaNumero(otro.numero)} (${otro.marca} ${otro.modelo}).`
    );
  }
}

/**
 * Bloquea la fila del taller hasta el final de la transacción: dos cargas
 * simultáneas del mismo IMEI se hacen una después de la otra, y la segunda ve
 * a la primera al buscar repetidos.
 */
async function bloquearStockDelTaller(tallerId: number, transaction: Transaction) {
  await Taller.findByPk(tallerId, { attributes: ['id'], lock: transaction.LOCK.UPDATE, transaction });
}

/** Los montos como los guarda la base: DECIMAL, que Sequelize maneja como string. */
function filaDe(datos: EquipoStockInput) {
  return {
    ...datos,
    costo: datos.costo.toFixed(2),
    cotizacionCosto: datos.cotizacionCosto?.toFixed(4) ?? null,
    precio: datos.precio?.toFixed(2) ?? null
  };
}

type FilaNueva = Omit<EquipoStockCreationAttributes, 'tallerId' | 'sucursalId' | 'numero' | 'cargadoPorId'>;

/** Alta de un equipo dentro de una transacción ya abierta (la usa también la venta, con la parte de pago). */
export async function ingresarAlStock(ctx: ContextoStock, fila: FilaNueva, transaction: Transaction) {
  await bloquearStockDelTaller(ctx.tallerId, transaction);
  await exigirSinRepetidos(ctx.tallerId, fila as Identificacion, { transaction });
  const numero = await Contador.reservarSiguiente(`stock:${ctx.tallerId}`, transaction);
  return EquipoStock.create(
    { ...fila, tallerId: ctx.tallerId, sucursalId: ctx.sucursalId, numero, cargadoPorId: ctx.usuarioId },
    { transaction }
  );
}

export async function crearEquipoStock(ctx: ContextoStock, datos: EquipoStockInput) {
  const creado = await sequelize.transaction((transaction) =>
    ingresarAlStock(ctx, filaDe(datos), transaction)
  );
  return serializarEquipoStock(await equipoVisible(ctx, creado.id), ctx.esAdmin);
}

/**
 * Quien no es admin no ve los costos, así que tampoco los cambia: al editar se
 * conservan los que tenía el equipo.
 */
export function conCostosDe(equipo: EquipoStock, datos: Record<string, unknown>): Record<string, unknown> {
  return {
    ...datos,
    monedaCosto: equipo.monedaCosto,
    costo: aNumero(equipo.costo),
    cotizacionCosto: equipo.cotizacionCosto == null ? null : aNumero(equipo.cotizacionCosto)
  };
}

/** Un vendido o dado de baja ya no se edita: sus datos son los de ese momento. */
export async function actualizarEquipoStock(
  ctx: ContextoStock,
  equipo: EquipoStock,
  datos: EquipoStockInput
) {
  if (equipo.estado === 'vendido') {
    throw errores.conflicto('El equipo ya se vendió: sus datos no se pueden cambiar.');
  }
  if (equipo.estado === 'baja') throw errores.conflicto('El equipo está dado de baja.');
  await sequelize.transaction(async (transaction) => {
    await bloquearStockDelTaller(ctx.tallerId, transaction);
    await exigirSinRepetidos(ctx.tallerId, datos, { excluirId: equipo.id, transaction });
    await equipo.update(filaDe(datos), { transaction });
  });
  return serializarEquipoStock(await equipoVisible(ctx, equipo.id), ctx.esAdmin);
}

/**
 * Sacar un equipo del stock (una carga equivocada, un equipo roto). Nunca se
 * borra la fila: queda dado de baja con quién, cuándo y por qué. Solo un equipo
 * que no está apartado ni vendido.
 */
export async function darDeBajaEquipoStock(ctx: ContextoStock, equipo: EquipoStock, motivo: string) {
  if (equipo.estado !== 'disponible') {
    throw errores.conflicto(
      'Solo se puede dar de baja un equipo disponible: este está apartado, vendido o ya dado de baja.'
    );
  }
  await equipo.update({ estado: 'baja', bajaEn: new Date(), bajaPorId: ctx.usuarioId, motivoBaja: motivo });
  return serializarEquipoStock(await equipoVisible(ctx, equipo.id), ctx.esAdmin);
}

/** Costo en dólares de una fila (compra más reparaciones), en SQL, para sumar sin traer todo el stock. */
const COSTO_USD = literal(
  "CASE WHEN moneda_costo = 'USD' THEN costo ELSE costo / cotizacion_costo END + costo_reparaciones_usd"
);

interface FilaPorModelo {
  marca: string;
  modelo: string;
  almacenamientoGb: number | null;
  monedaCosto: string;
  costo: string;
  cantidad: number | string;
}

/**
 * Cantidades por estado, costo de lo que queda (en US$) y lo que hay de cada
 * modelo con cada costo: "3 iPhone 13 de 128 GB, 1 a US$ 1.000 y 2 a US$ 900".
 * Mira la sucursal del listado, sin los demás filtros.
 */
async function resumenDelStock(base: WhereOptions<EquipoStockAttributes>, verCostos: boolean) {
  const enStock = { ...base, estado: { [Op.notIn]: FUERA_DEL_STOCK } };

  const [porEstado, costo, filas] = await Promise.all([
    EquipoStock.findAll({
      where: base,
      attributes: ['estado', [fn('COUNT', col('id')), 'cantidad']],
      group: ['estado'],
      raw: true
    }) as unknown as Promise<{ estado: EstadoStock; cantidad: number | string }[]>,
    EquipoStock.findOne({
      where: enStock,
      attributes: [[fn('SUM', COSTO_USD), 'total']],
      raw: true
    }) as unknown as Promise<{ total: string | null } | null>,
    EquipoStock.findAll({
      where: enStock,
      attributes: [
        'marca',
        'modelo',
        'almacenamientoGb',
        'monedaCosto',
        'costo',
        [fn('COUNT', col('id')), 'cantidad']
      ],
      group: ['marca', 'modelo', 'almacenamiento_gb', 'moneda_costo', 'costo'],
      order: [
        ['marca', 'ASC'],
        ['modelo', 'ASC'],
        ['almacenamientoGb', 'ASC'],
        ['costo', 'DESC']
      ],
      raw: true
    }) as unknown as Promise<FilaPorModelo[]>
  ]);

  const cantidades = Object.fromEntries(porEstado.map((f) => [f.estado, Number(f.cantidad)]));

  const modelos = new Map<
    string,
    Pick<FilaPorModelo, 'marca' | 'modelo' | 'almacenamientoGb'> & {
      cantidad: number;
      costos: { moneda: string; costo: number; cantidad: number }[];
    }
  >();
  for (const fila of filas) {
    const clave = `${fila.marca}|${fila.modelo}|${fila.almacenamientoGb ?? ''}`;
    const modelo = modelos.get(clave) ?? {
      marca: fila.marca,
      modelo: fila.modelo,
      almacenamientoGb: fila.almacenamientoGb,
      cantidad: 0,
      costos: []
    };
    modelo.cantidad += Number(fila.cantidad);
    if (verCostos) {
      modelo.costos.push({
        moneda: fila.monedaCosto,
        costo: aNumero(fila.costo),
        cantidad: Number(fila.cantidad)
      });
    }
    modelos.set(clave, modelo);
  }

  return {
    disponibles: cantidades.disponible ?? 0,
    reservados: cantidades.reservado ?? 0,
    senados: cantidades.senado ?? 0,
    vendidos: cantidades.vendido ?? 0,
    bajas: cantidades.baja ?? 0,
    costoStockUsd: verCostos ? redondearMonto(aNumero(costo?.total)) : null,
    porModelo: [...modelos.values()]
  };
}

/**
 * Los proveedores a los que ya se les compró, el último primero: para que al
 * cargar otro equipo no haya que escribir el nombre entero (ni con otra grafía).
 */
export async function proveedoresUsados(tallerId: number): Promise<string[]> {
  const filas = await EquipoStock.findAll({
    where: { tallerId, proveedor: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: PROVEEDOR_PARTE_DE_PAGO }] } },
    attributes: ['proveedor', [fn('MAX', col('id')), 'ultimo']],
    group: ['proveedor'],
    order: [[literal('ultimo'), 'DESC']],
    limit: LIMITE_PROVEEDORES,
    raw: true
  });
  return filas.map((f) => f.proveedor).filter((p): p is string => Boolean(p?.trim()));
}

export async function listarStock(ctx: ContextoStock, filtros: z.infer<typeof listarStockQuery>) {
  const sucursalId = await sucursalDelFiltro(ctx, filtros.sucursal);
  const base: WhereOptions<EquipoStockAttributes> = {
    tallerId: ctx.tallerId,
    ...(sucursalId ? { sucursalId } : {})
  };

  const { search } = filtros;
  // "#42" o "42" también busca por número de stock.
  const numero = search && /^#?\d{1,9}$/.test(search) ? Number(search.replace('#', '')) : null;
  const where: WhereOptions<EquipoStockAttributes> = {
    ...base,
    // Los dados de baja se ven solo si se los pide.
    estado: filtros.estado ?? { [Op.ne]: 'baja' },
    ...(filtros.condicion ? { condicion: filtros.condicion } : {}),
    ...(search
      ? {
          [Op.or]: [
            ...['marca', 'modelo', 'color', 'numeroSerie', 'imei', 'imei2'].map((campo) => ({
              [campo]: { [Op.like]: `%${search}%` }
            })),
            ...(numero ? [{ numero }] : [])
          ]
        }
      : {})
  };

  const [equipos, resumen] = await Promise.all([
    EquipoStock.findAll({
      where,
      include: INCLUDES,
      order: [
        ['fechaCompra', 'DESC'],
        ['id', 'DESC']
      ],
      limit: LIMITE_LISTADO
    }),
    resumenDelStock(base, ctx.esAdmin)
  ]);

  return { equipos: await serializarConVenta(equipos, ctx.esAdmin), resumen };
}

const COSTO_INCLUDES = [
  { model: User, as: 'usuario', attributes: ['id', 'nombre', 'apellido'] },
  { model: User, as: 'anuladoPor', attributes: ['id', 'nombre', 'apellido'] }
];

/** Los costos que se le agregaron al equipo, también los anulados (quedan como registro). Solo admin. */
export function costosDeEquipo(equipoId: number) {
  return EquipoStockCosto.findAll({
    where: { equipoStockId: equipoId },
    include: COSTO_INCLUDES,
    order: [
      ['fecha', 'ASC'],
      ['id', 'ASC']
    ]
  });
}

/**
 * Vuelve a sumar los costos vigentes en el equipo. El equipo ya tiene que estar
 * bloqueado: dos costos cargados a la vez no se pisan la suma.
 */
async function recalcularReparaciones(equipoId: number, transaction: Transaction) {
  const total = await EquipoStockCosto.sum('montoUsd', {
    where: { equipoStockId: equipoId, anuladoEn: null },
    transaction
  });
  await EquipoStock.update(
    { costoReparacionesUsd: redondearMonto(aNumero(total)).toFixed(2) },
    { where: { id: equipoId }, transaction }
  );
}

async function bloquearEquipo(equipo: EquipoStock, transaction: Transaction) {
  await EquipoStock.findByPk(equipo.id, { attributes: ['id'], lock: transaction.LOCK.UPDATE, transaction });
}

/**
 * Agrega un costo al equipo: suma a lo que costó y baja la ganancia cuando se
 * venda. También sobre uno ya vendido (una garantía que hubo que cubrir): cambia
 * la ganancia de esa venta.
 */
export async function agregarCosto(ctx: ContextoStock, equipo: EquipoStock, datos: CostoReparacionInput) {
  await sequelize.transaction(async (transaction) => {
    await bloquearEquipo(equipo, transaction);
    await EquipoStockCosto.create(
      {
        tallerId: ctx.tallerId,
        equipoStockId: equipo.id,
        concepto: datos.concepto,
        fecha: datos.fecha ?? fechaEnZona(new Date(), env.timezone),
        moneda: datos.moneda,
        monto: datos.monto.toFixed(2),
        cotizacion: datos.cotizacion?.toFixed(4) ?? null,
        montoUsd: enDolares(datos.monto, datos.moneda, datos.cotizacion).toFixed(2),
        usuarioId: ctx.usuarioId
      },
      { transaction }
    );
    await recalcularReparaciones(equipo.id, transaction);
  });
}

/** Un costo cargado por error no se borra: queda anulado, con quién y cuándo, y deja de sumar. */
export async function anularCosto(ctx: ContextoStock, equipo: EquipoStock, costoId: number) {
  await sequelize.transaction(async (transaction) => {
    await bloquearEquipo(equipo, transaction);
    const costo = await EquipoStockCosto.findOne({
      where: { id: costoId, equipoStockId: equipo.id },
      transaction
    });
    if (!costo) throw errores.noEncontrado('Costo');
    if (costo.anuladoEn) throw errores.conflicto('El costo ya está anulado.');
    await costo.update({ anuladoEn: new Date(), anuladoPorId: ctx.usuarioId }, { transaction });
    await recalcularReparaciones(equipo.id, transaction);
  });
}
