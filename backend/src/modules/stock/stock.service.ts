import { Op, WhereOptions, col, fn, literal } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../../config/database';
import { Contador, EquipoStock, Sucursal, Taller } from '../../models';
import { EquipoStockAttributes, EstadoStock } from '../../models/EquipoStock';
import { errores } from '../../shared/http/http-error';
import { aNumero, enDolares, redondearMonto } from '../../shared/utils/dinero';
import { EquipoStockInput, listarStockQuery } from './stock.schemas';

/** Quién opera: el stock se carga y se ve desde la sucursal elegida. */
export interface ContextoStock {
  tallerId: number;
  sucursalId: number;
  usuarioId: number;
}

const LIMITE_LISTADO = 200;

const INCLUDES = [{ model: Sucursal, as: 'sucursal', attributes: ['id', 'nombre'] }];

/** #0042: el número con el que se nombra al equipo en el mostrador. */
export const etiquetaNumero = (numero: number) => `#${String(numero).padStart(4, '0')}`;

/** Equipo tal como sale por la API, con el costo ya pasado a dólares para sumar. */
export function serializarEquipoStock(equipo: EquipoStock) {
  return {
    ...equipo.get({ plain: true }),
    costoUsd: enDolares(equipo.costo, equipo.monedaCosto, equipo.cotizacionCosto)
  };
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

/**
 * Un IMEI o un serial no puede estar dos veces en el stock. Se compara solo con
 * lo no vendido: un equipo que se vendió puede volver (en parte de pago, por ejemplo).
 */
async function exigirSinDuplicados(tallerId: number, datos: EquipoStockInput, excluirId?: number) {
  const imeis = [datos.imei, datos.imei2].filter((v): v is string => Boolean(v));
  const condiciones: WhereOptions<EquipoStockAttributes>[] = [
    ...imeis.flatMap((imei) => [{ imei }, { imei2: imei }]),
    ...(datos.numeroSerie ? [{ numeroSerie: datos.numeroSerie }] : [])
  ];
  if (condiciones.length === 0) return;

  const otro = await EquipoStock.findOne({
    where: {
      tallerId,
      estado: { [Op.ne]: 'vendido' },
      [Op.or]: condiciones,
      ...(excluirId ? { id: { [Op.ne]: excluirId } } : {})
    },
    attributes: ['numero', 'marca', 'modelo']
  });
  if (otro) {
    throw errores.conflicto(
      `Ese IMEI o número de serie ya está en el stock: ${etiquetaNumero(otro.numero)} (${otro.marca} ${otro.modelo}).`
    );
  }
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

export async function crearEquipoStock(ctx: ContextoStock, datos: EquipoStockInput) {
  await exigirSinDuplicados(ctx.tallerId, datos);
  const creado = await sequelize.transaction(async (transaction) => {
    const numero = await Contador.reservarSiguiente(`stock:${ctx.tallerId}`, transaction);
    return EquipoStock.create(
      {
        ...filaDe(datos),
        tallerId: ctx.tallerId,
        sucursalId: ctx.sucursalId,
        numero,
        cargadoPorId: ctx.usuarioId
      },
      { transaction }
    );
  });
  return serializarEquipoStock(await equipoVisible(ctx, creado.id));
}

/** Un vendido ya no se edita: sus datos son los de la venta. */
export async function actualizarEquipoStock(
  ctx: ContextoStock,
  equipo: EquipoStock,
  datos: EquipoStockInput
) {
  if (equipo.estado === 'vendido') {
    throw errores.conflicto('El equipo ya se vendió: sus datos no se pueden cambiar.');
  }
  await exigirSinDuplicados(ctx.tallerId, datos, equipo.id);
  await equipo.update(filaDe(datos));
  return serializarEquipoStock(await equipoVisible(ctx, equipo.id));
}

/** Para corregir una carga equivocada: solo un equipo que no está apartado ni vendido. */
export async function eliminarEquipoStock(equipo: EquipoStock): Promise<void> {
  if (equipo.estado !== 'disponible') {
    throw errores.conflicto('Solo se puede borrar un equipo disponible: este está apartado o vendido.');
  }
  await equipo.destroy();
}

/** Costo en dólares de una fila, en SQL, para sumar sin traer todo el stock. */
const COSTO_USD = literal("CASE WHEN moneda_costo = 'USD' THEN costo ELSE costo / cotizacion_costo END");

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
async function resumenDelStock(base: WhereOptions<EquipoStockAttributes>) {
  const enStock = { ...base, estado: { [Op.ne]: 'vendido' as EstadoStock } };

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
    modelo.costos.push({
      moneda: fila.monedaCosto,
      costo: aNumero(fila.costo),
      cantidad: Number(fila.cantidad)
    });
    modelos.set(clave, modelo);
  }

  return {
    disponibles: cantidades.disponible ?? 0,
    reservados: cantidades.reservado ?? 0,
    senados: cantidades.senado ?? 0,
    vendidos: cantidades.vendido ?? 0,
    costoStockUsd: redondearMonto(aNumero(costo?.total)),
    porModelo: [...modelos.values()]
  };
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
    ...(filtros.estado ? { estado: filtros.estado } : {}),
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
    resumenDelStock(base)
  ]);

  return { equipos: equipos.map(serializarEquipoStock), resumen };
}
