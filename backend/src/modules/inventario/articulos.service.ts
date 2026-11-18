import { Op, Transaction, UniqueConstraintError, WhereOptions } from 'sequelize';
import { z } from 'zod';
import { env } from '../../config/env';
import {
  Articulo,
  Contador,
  EquipoStock,
  InventarioCategoria,
  InventarioEntrada,
  InventarioMovimiento,
  Orden,
  Pase,
  ServicioRepuesto,
  Sucursal,
  Taller,
  User,
  Venta,
  sequelize
} from '../../models';
import { TIPOS_PRODUCTO, type TipoArticulo } from '../../models/Articulo';
import { errores } from '../../shared/http/http-error';
import { type Moneda, aNumero, redondearMonto } from '../../shared/utils/dinero';
import { fechaEnZona } from '../../shared/utils/fechas';
import { etiquetaVenta } from '../ventas/calculos';
import {
  type ConfigInventario,
  codigoGenerado,
  configDeInventario,
  etiquetaEntrada,
  etiquetaPase
} from './config';
import {
  type ContextoInventario,
  existencias,
  ingresarEntrada,
  registrarMovimiento
} from './existencias.service';
import {
  ActualizarArticuloInput,
  ConfigInventarioInput,
  CrearArticuloInput,
  AjusteInput,
  NuevaEntradaInput,
  listarArticulosQuery
} from './inventario.schemas';

const LIMITE_LISTADO = 500;
const LIMITE_MOVIMIENTOS = 100;
const LIMITE_AGOTADAS = 20;

export const hoy = () => fechaEnZona(new Date(), env.timezone);

// ── Configuración y categorías ───────────────────────────────────────────────

export async function configDelTaller(
  tallerId: number,
  transaction?: Transaction
): Promise<ConfigInventario> {
  const taller = await Taller.findByPk(tallerId, { attributes: ['inventarioConfig'], transaction });
  return configDeInventario(taller?.inventarioConfig);
}

export async function guardarConfig(tallerId: number, datos: ConfigInventarioInput) {
  const precios = [0, 1, 2].map((i) => datos.precios[i] ?? null);
  await Taller.update({ inventarioConfig: { ...datos, precios } }, { where: { id: tallerId } });
  return configDelTaller(tallerId);
}

export function listarCategorias(tallerId: number) {
  return InventarioCategoria.findAll({
    where: { tallerId },
    order: [
      ['grupo', 'ASC'],
      ['nombre', 'ASC']
    ]
  });
}

/** Cuántos artículos activos tiene cada categoría: para no borrar una que está en uso. */
export async function usoDeCategorias(tallerId: number): Promise<Record<number, number>> {
  const filas = (await Articulo.findAll({
    where: { tallerId, categoriaId: { [Op.ne]: null } },
    attributes: ['categoriaId', [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']],
    group: ['categoriaId'],
    raw: true
  })) as unknown as { categoriaId: number; cantidad: number | string }[];
  return Object.fromEntries(filas.map((f) => [f.categoriaId, Number(f.cantidad)]));
}

function nombreRepetido(err: unknown): never {
  if (err instanceof UniqueConstraintError) throw errores.conflicto('Ya hay una categoría con ese nombre.');
  throw err;
}

export async function crearCategoria(tallerId: number, grupo: TipoArticulo, nombre: string) {
  return InventarioCategoria.create({ tallerId, grupo, nombre }).catch(nombreRepetido);
}

async function categoriaDelTaller(tallerId: number, id: number, transaction?: Transaction) {
  const categoria = await InventarioCategoria.findOne({ where: { id, tallerId }, transaction });
  if (!categoria) throw errores.noEncontrado('Categoría');
  return categoria;
}

export async function renombrarCategoria(tallerId: number, id: number, nombre: string) {
  const categoria = await categoriaDelTaller(tallerId, id);
  return categoria.update({ nombre }).catch(nombreRepetido);
}

export async function borrarCategoria(tallerId: number, id: number) {
  const categoria = await categoriaDelTaller(tallerId, id);
  if (await Articulo.count({ where: { categoriaId: id } })) {
    throw errores.conflicto('La categoría tiene artículos: pasalos a otra antes de borrarla.');
  }
  await categoria.destroy();
}

// ── Artículos ────────────────────────────────────────────────────────────────

async function veOtrasSucursales(tallerId: number): Promise<boolean> {
  const taller = await Taller.findByPk(tallerId, { attributes: ['stockEntreSucursales'] });
  return Boolean(taller?.stockEntreSucursales);
}

/**
 * Qué sucursal se mira. Sin indicar, la elegida; otra (o todas) solo si el
 * taller comparte el stock entre sucursales. `null` es todas.
 */
export async function sucursalDelFiltro(
  ctx: ContextoInventario,
  pedida?: 'todas' | number
): Promise<number | null> {
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

export async function articuloDelTaller(tallerId: number, id: number, transaction?: Transaction) {
  const articulo = await Articulo.findOne({
    where: { id, tallerId },
    include: [{ model: InventarioCategoria, as: 'categoria', attributes: ['id', 'nombre'] }],
    transaction
  });
  if (!articulo) throw errores.noEncontrado('Artículo');
  return articulo;
}

/** Los precios con los nombres del taller. Las posiciones que el taller no usa no se muestran. */
function preciosDe(articulo: Articulo, config: ConfigInventario) {
  return config.precios.flatMap((nombre, i) => {
    if (!nombre) return [];
    const posicion = (i + 1) as 1 | 2 | 3;
    const monto = articulo[`precio${posicion}`];
    return [
      {
        posicion,
        nombre,
        monto: monto == null ? null : aNumero(monto),
        moneda: articulo[`moneda${posicion}`]
      }
    ];
  });
}

interface GrupoCosto {
  moneda: Moneda;
  costo: number;
  costoUsd: number;
  cantidad: number;
}

/** "5 × US$ 100 · 5 × US$ 120": lo que queda agrupado por costo, de lo más viejo a lo más nuevo. */
function agruparCostos(entradas: InventarioEntrada[]): GrupoCosto[] {
  const grupos: GrupoCosto[] = [];
  for (const e of entradas) {
    const costo = aNumero(e.costo);
    const igual = grupos.find((g) => g.moneda === e.moneda && g.costo === costo);
    if (igual) igual.cantidad += e.disponible;
    else grupos.push({ moneda: e.moneda, costo, costoUsd: aNumero(e.costoUsd), cantidad: e.disponible });
  }
  return grupos;
}

/** Costo de las próximas `cantidad` unidades, tomando de lo más viejo: lo que costaría usarlas hoy. */
function costoDeLasProximas(entradas: InventarioEntrada[], cantidad: number): number | null {
  let falta = cantidad;
  let total = 0;
  for (const e of entradas) {
    const tomar = Math.min(e.disponible, falta);
    total += tomar * aNumero(e.costoUsd);
    falta -= tomar;
    if (falta <= 0) break;
  }
  return falta > 0 ? null : redondearMonto(total);
}

/** Las entradas con unidades, de la más vieja a la más nueva, agrupadas por artículo. */
async function entradasConStockDe(articuloIds: number[], sucursalId: number | null) {
  if (articuloIds.length === 0) return new Map<number, InventarioEntrada[]>();
  const entradas = await InventarioEntrada.findAll({
    where: { articuloId: articuloIds, disponible: { [Op.gt]: 0 }, ...(sucursalId ? { sucursalId } : {}) },
    order: [
      ['fecha', 'ASC'],
      ['id', 'ASC']
    ]
  });
  const porArticulo = new Map<number, InventarioEntrada[]>();
  for (const e of entradas) porArticulo.set(e.articuloId, [...(porArticulo.get(e.articuloId) ?? []), e]);
  return porArticulo;
}

/** El último costo pagado de cada artículo: para mostrar algo cuando no queda ninguno. */
async function ultimosCostos(articuloIds: number[]) {
  if (articuloIds.length === 0) return new Map<number, InventarioEntrada>();
  const entradas = await InventarioEntrada.findAll({
    where: { articuloId: articuloIds, origen: 'compra' },
    order: [['id', 'DESC']]
  });
  const ultimos = new Map<number, InventarioEntrada>();
  for (const e of entradas) if (!ultimos.has(e.articuloId)) ultimos.set(e.articuloId, e);
  return ultimos;
}

/**
 * Un artículo tal como sale por la API: precios con nombre, lo que hay en la
 * sucursal mirada y, para un admin, lo que costó lo que queda.
 */
function serializarArticulo(
  articulo: Articulo,
  config: ConfigInventario,
  extra: { cantidad: number; entradas: InventarioEntrada[]; ultimo?: InventarioEntrada; verCostos: boolean }
) {
  const { cantidad, entradas, ultimo, verCostos } = extra;
  const esProducto = articulo.tipo !== 'servicio';
  return {
    id: articulo.id,
    tipo: articulo.tipo,
    codigo: articulo.codigo,
    codigoBarras: articulo.codigoBarras,
    nombre: articulo.nombre,
    categoria: articulo.categoria ? { id: articulo.categoria.id, nombre: articulo.categoria.nombre } : null,
    stockMinimo: articulo.stockMinimo,
    activo: articulo.activo,
    precios: preciosDe(articulo, config),
    cantidad: esProducto ? cantidad : null,
    bajoMinimo: esProducto && articulo.stockMinimo > 0 && cantidad < articulo.stockMinimo,
    costos: verCostos && esProducto ? agruparCostos(entradas) : null,
    costoStockUsd:
      verCostos && esProducto
        ? redondearMonto(entradas.reduce((t, e) => t + e.disponible * aNumero(e.costoUsd), 0))
        : null,
    ultimoCosto:
      verCostos && ultimo
        ? { moneda: ultimo.moneda, costo: aNumero(ultimo.costo), costoUsd: aNumero(ultimo.costoUsd) }
        : null
  };
}

export async function listarArticulos(
  ctx: ContextoInventario,
  filtros: z.infer<typeof listarArticulosQuery>
) {
  const sucursalId = await sucursalDelFiltro(ctx, filtros.sucursal);
  const config = await configDelTaller(ctx.tallerId);
  const { search } = filtros;
  const where: WhereOptions = {
    tallerId: ctx.tallerId,
    ...(filtros.archivados ? {} : { activo: true }),
    ...(filtros.tipo === 'productos' ? { tipo: TIPOS_PRODUCTO } : filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
    ...(search
      ? {
          [Op.or]: [
            { nombre: { [Op.like]: `%${search}%` } },
            { codigo: { [Op.like]: `%${search}%` } },
            { codigoBarras: search }
          ]
        }
      : {})
  };
  const articulos = await Articulo.findAll({
    where,
    include: [{ model: InventarioCategoria, as: 'categoria', attributes: ['id', 'nombre'] }],
    order: [['nombre', 'ASC']],
    limit: LIMITE_LISTADO
  });
  const ids = articulos.filter((a) => a.tipo !== 'servicio').map((a) => a.id);
  const [cantidades, entradas, ultimos] = await Promise.all([
    existencias(ctx.tallerId, sucursalId, ids),
    entradasConStockDe(ids, sucursalId),
    ctx.esAdmin ? ultimosCostos(ids) : Promise.resolve(new Map<number, InventarioEntrada>())
  ]);

  let filas = articulos.map((a) =>
    serializarArticulo(a, config, {
      cantidad: cantidades.get(a.id) ?? 0,
      entradas: entradas.get(a.id) ?? [],
      ultimo: ultimos.get(a.id),
      verCostos: ctx.esAdmin
    })
  );
  const productos = filas.filter((f) => f.tipo !== 'servicio');
  const resumen = {
    productos: productos.length,
    unidades: productos.reduce((t, f) => t + (f.cantidad ?? 0), 0),
    costoStockUsd: ctx.esAdmin
      ? redondearMonto(productos.reduce((t, f) => t + (f.costoStockUsd ?? 0), 0))
      : null,
    bajoMinimo: productos.filter((f) => f.bajoMinimo).length
  };
  if (filtros.bajoMinimo) filas = filas.filter((f) => f.bajoMinimo);

  // Para un servicio: lo que llevan, con lo que costaría usarlo hoy.
  const servicios = articulos.filter((a) => a.tipo === 'servicio');
  const repuestos = await repuestosDeServicios(
    servicios.map((s) => s.id),
    ctx,
    sucursalId ?? ctx.sucursalId
  );
  const conRepuestos = filas.map((f) => (f.tipo === 'servicio' ? { ...f, ...repuestos.get(f.id) } : f));

  return { articulos: conRepuestos, resumen, config };
}

/** Los repuestos de cada servicio y lo que costarían hoy en la sucursal (solo admin). */
async function repuestosDeServicios(servicioIds: number[], ctx: ContextoInventario, sucursalId: number) {
  const resultado = new Map<number, { repuestos: unknown[]; costoHoyUsd: number | null }>();
  if (servicioIds.length === 0) return resultado;
  const filas = await ServicioRepuesto.findAll({
    where: { servicioId: servicioIds },
    include: [{ model: Articulo, as: 'repuesto', attributes: ['id', 'codigo', 'nombre', 'tipo'] }],
    order: [['id', 'ASC']]
  });
  const entradas = ctx.esAdmin
    ? await entradasConStockDe([...new Set(filas.map((f) => f.repuestoId))], sucursalId)
    : new Map<number, InventarioEntrada[]>();
  for (const id of servicioIds) {
    const propios = filas.filter((f) => f.servicioId === id);
    const costos = propios.map((f) => costoDeLasProximas(entradas.get(f.repuestoId) ?? [], f.cantidad));
    resultado.set(id, {
      repuestos: propios.map((f, i) => ({
        repuesto: f.repuesto,
        cantidad: f.cantidad,
        costoHoyUsd: ctx.esAdmin ? costos[i] : null
      })),
      costoHoyUsd:
        ctx.esAdmin && costos.every((c) => c !== null)
          ? redondearMonto(costos.reduce<number>((t, c) => t + (c ?? 0), 0))
          : null
    });
  }
  return resultado;
}

/** Busca por código o código de barras exacto: lo que devuelve el escáner. */
export async function buscarPorCodigo(tallerId: number, codigo: string) {
  return Articulo.findOne({
    where: { tallerId, activo: true, [Op.or]: [{ codigo }, { codigoBarras: codigo }] },
    attributes: ['id', 'tipo', 'codigo', 'nombre']
  });
}

function filaDePrecios(precios: ({ monto: number; moneda: Moneda } | null)[]) {
  return Object.fromEntries(
    [1, 2, 3].flatMap((posicion) => {
      const precio = precios[posicion - 1] ?? null;
      return [
        [`precio${posicion}`, precio ? precio.monto.toFixed(2) : null],
        [`moneda${posicion}`, precio ? precio.moneda : null]
      ];
    })
  ) as Pick<Articulo, 'precio1' | 'moneda1' | 'precio2' | 'moneda2' | 'precio3' | 'moneda3'>;
}

async function validarCategoria(
  tallerId: number,
  tipo: TipoArticulo,
  categoriaId: number | null | undefined
) {
  if (!categoriaId) return null;
  const categoria = await categoriaDelTaller(tallerId, categoriaId);
  if (categoria.grupo !== tipo) throw errores.solicitudInvalida('La categoría es de otro grupo.');
  return categoria.id;
}

async function guardarRepuestosDeServicio(
  tallerId: number,
  servicioId: number,
  repuestos: { repuestoId: number; cantidad: number }[],
  transaction: Transaction
) {
  const ids = repuestos.map((r) => r.repuestoId);
  const encontrados = await Articulo.count({
    where: { id: ids, tallerId, tipo: TIPOS_PRODUCTO },
    transaction
  });
  if (encontrados !== ids.length)
    throw errores.solicitudInvalida('Un servicio lleva repuestos o accesorios del inventario.');
  await ServicioRepuesto.destroy({ where: { servicioId }, transaction });
  await ServicioRepuesto.bulkCreate(
    repuestos.map((r) => ({ servicioId, repuestoId: r.repuestoId, cantidad: r.cantidad })),
    { transaction }
  );
}

function codigoRepetido(err: unknown): never {
  if (err instanceof UniqueConstraintError) throw errores.conflicto('Ya hay un artículo con ese código.');
  throw err;
}

/** El próximo código libre del tipo: "R-0013". Se saltea alguno que alguien haya puesto a mano. */
async function generarCodigo(
  tallerId: number,
  tipo: TipoArticulo,
  prefijo: string,
  transaction: Transaction
) {
  for (;;) {
    const n = await Contador.reservarSiguiente(`articulo:${tipo}:${tallerId}`, transaction);
    const codigo = codigoGenerado(prefijo, n);
    if (!(await Articulo.count({ where: { tallerId, codigo }, transaction }))) return codigo;
  }
}

export async function crearArticulo(ctx: ContextoInventario, datos: CrearArticuloInput) {
  const config = await configDelTaller(ctx.tallerId);
  const categoriaId = await validarCategoria(ctx.tallerId, datos.tipo, datos.categoriaId);
  if (datos.tipo === 'servicio' && datos.entrada)
    throw errores.solicitudInvalida('Un servicio no tiene stock.');

  const id = await sequelize
    .transaction(async (transaction) => {
      const articulo = await Articulo.create(
        {
          tallerId: ctx.tallerId,
          tipo: datos.tipo,
          categoriaId,
          codigo:
            datos.codigo ??
            (await generarCodigo(ctx.tallerId, datos.tipo, config.prefijos[datos.tipo], transaction)),
          codigoBarras: datos.codigoBarras,
          nombre: datos.nombre,
          stockMinimo: datos.tipo === 'servicio' ? 0 : (datos.stockMinimo ?? config.stockMinimoPorDefecto),
          ...filaDePrecios(datos.precios)
        },
        { transaction }
      );
      if (datos.tipo === 'servicio' && datos.repuestos?.length) {
        await guardarRepuestosDeServicio(ctx.tallerId, articulo.id, datos.repuestos, transaction);
      }
      if (datos.entrada) {
        await ingresarEntrada(
          ctx,
          {
            articulo,
            sucursalId: ctx.sucursalId,
            cantidad: datos.entrada.cantidad,
            moneda: datos.entrada.moneda,
            costo: datos.entrada.costo,
            cotizacion: datos.entrada.cotizacion ?? null,
            fecha: datos.entrada.fecha ?? hoy(),
            proveedor: datos.entrada.proveedor,
            nota: datos.entrada.nota
          },
          transaction
        );
      }
      return articulo.id;
    })
    .catch(codigoRepetido);
  return detalleArticulo(ctx, id);
}

export async function actualizarArticulo(
  ctx: ContextoInventario,
  id: number,
  datos: ActualizarArticuloInput
) {
  const articulo = await articuloDelTaller(ctx.tallerId, id);
  const categoriaId = await validarCategoria(ctx.tallerId, articulo.tipo, datos.categoriaId);
  await sequelize
    .transaction(async (transaction) => {
      await articulo.update(
        {
          categoriaId,
          nombre: datos.nombre,
          ...(datos.codigo ? { codigo: datos.codigo } : {}),
          codigoBarras: datos.codigoBarras,
          ...(articulo.tipo !== 'servicio' && datos.stockMinimo !== undefined
            ? { stockMinimo: datos.stockMinimo }
            : {}),
          ...filaDePrecios(datos.precios)
        },
        { transaction }
      );
      if (articulo.tipo === 'servicio' && datos.repuestos) {
        if (datos.repuestos.some((r) => r.repuestoId === articulo.id)) {
          throw errores.solicitudInvalida('Un servicio no se lleva a sí mismo.');
        }
        await guardarRepuestosDeServicio(ctx.tallerId, articulo.id, datos.repuestos, transaction);
      }
    })
    .catch(codigoRepetido);
  return detalleArticulo(ctx, id);
}

/** Archivar no borra: el artículo deja de aparecer para usar o vender, pero sigue en el historial. */
export async function archivarArticulo(ctx: ContextoInventario, id: number, activo: boolean) {
  const articulo = await articuloDelTaller(ctx.tallerId, id);
  await articulo.update({ activo });
  return detalleArticulo(ctx, id);
}

const USUARIO = ['id', 'nombre', 'apellido'];

/**
 * El artículo con lo que hay en cada sucursal, las entradas de la sucursal
 * mirada (las que tienen unidades y las últimas agotadas), sus movimientos y,
 * para un servicio, los repuestos que lleva. Los costos, solo para un admin.
 */
export async function detalleArticulo(ctx: ContextoInventario, id: number, sucursalPedida?: number) {
  const sucursalId = (await sucursalDelFiltro(ctx, sucursalPedida)) ?? ctx.sucursalId;
  const [articulo, config] = await Promise.all([
    articuloDelTaller(ctx.tallerId, id),
    configDelTaller(ctx.tallerId)
  ]);
  const verCostos = ctx.esAdmin;

  const [conStock, agotadas, cantidades, sucursales, movimientos, usadoEn, ultimos] = await Promise.all([
    entradasConStockDe([id], sucursalId),
    InventarioEntrada.findAll({
      where: { articuloId: id, sucursalId, disponible: 0 },
      order: [['id', 'DESC']],
      limit: LIMITE_AGOTADAS
    }),
    InventarioEntrada.findAll({
      where: { articuloId: id },
      attributes: ['sucursalId', [sequelize.fn('SUM', sequelize.col('disponible')), 'cantidad']],
      group: ['sucursalId'],
      raw: true
    }) as unknown as Promise<{ sucursalId: number; cantidad: string | number }[]>,
    Sucursal.findAll({
      where: { tallerId: ctx.tallerId, activo: true },
      attributes: ['id', 'nombre'],
      order: [['id', 'ASC']]
    }),
    InventarioMovimiento.findAll({
      where: { articuloId: id, sucursalId },
      include: [
        { model: User, as: 'usuario', attributes: USUARIO },
        {
          model: InventarioEntrada,
          as: 'entrada',
          attributes: ['id', 'numero', 'costoUsd', 'moneda', 'costo']
        },
        { model: Orden, as: 'orden', attributes: ['id', 'numeroOrden'] },
        { model: Venta, as: 'venta', attributes: ['id', 'numero'] },
        { model: Pase, as: 'pase', attributes: ['id', 'numero'] },
        { model: EquipoStock, as: 'equipoStock', attributes: ['id', 'numero', 'marca', 'modelo'] }
      ],
      order: [['id', 'DESC']],
      limit: LIMITE_MOVIMIENTOS
    }),
    ServicioRepuesto.findAll({
      where: { repuestoId: id },
      include: [{ model: Articulo, as: 'repuesto', attributes: [] }],
      attributes: ['servicioId', 'cantidad']
    }),
    verCostos ? ultimosCostos([id]) : Promise.resolve(new Map<number, InventarioEntrada>())
  ]);

  const entradas = conStock.get(id) ?? [];
  const porSucursal = new Map(cantidades.map((c) => [c.sucursalId, Number(c.cantidad)]));
  const compartido = ctx.esAdmin || (await veOtrasSucursales(ctx.tallerId));
  const servicios = usadoEn.length
    ? await Articulo.findAll({
        where: { id: usadoEn.map((u) => u.servicioId) },
        attributes: ['id', 'codigo', 'nombre']
      })
    : [];
  const repuestos =
    articulo.tipo === 'servicio' ? (await repuestosDeServicios([id], ctx, sucursalId)).get(id) : undefined;

  const serializarEntrada = (e: InventarioEntrada) => ({
    id: e.id,
    numero: e.numero,
    etiqueta: etiquetaEntrada(e.numero),
    origen: e.origen,
    fecha: e.fecha,
    cantidad: e.cantidad,
    disponible: e.disponible,
    proveedor: e.proveedor,
    nota: e.nota,
    moneda: verCostos ? e.moneda : null,
    costo: verCostos ? aNumero(e.costo) : null,
    cotizacion: verCostos && e.cotizacion != null ? aNumero(e.cotizacion) : null,
    costoUsd: verCostos ? aNumero(e.costoUsd) : null
  });

  return {
    ...serializarArticulo(articulo, config, {
      cantidad: porSucursal.get(sucursalId) ?? 0,
      entradas,
      ultimo: ultimos.get(id),
      verCostos
    }),
    ...repuestos,
    sucursalId,
    precioPosiciones: config.precios,
    // Los montos de los tres precios, también los de posiciones que no se muestran: para el formulario.
    preciosGuardados: [1, 2, 3].map((p) => {
      const monto = articulo[`precio${p as 1 | 2 | 3}`];
      return monto == null ? null : { monto: aNumero(monto), moneda: articulo[`moneda${p as 1 | 2 | 3}`] };
    }),
    porSucursal:
      articulo.tipo === 'servicio'
        ? []
        : sucursales
            .filter((s) => compartido || s.id === ctx.sucursalId)
            .map((s) => ({ id: s.id, nombre: s.nombre, cantidad: porSucursal.get(s.id) ?? 0 })),
    entradas: entradas.map(serializarEntrada),
    agotadas: agotadas.map(serializarEntrada),
    movimientos: movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      cantidad: m.cantidad,
      fecha: m.createdAt,
      nota: m.nota,
      usuario: m.usuario,
      entrada: m.entrada
        ? {
            id: m.entrada.id,
            etiqueta: etiquetaEntrada(m.entrada.numero),
            costoUsd: verCostos ? aNumero(m.entrada.costoUsd) : null
          }
        : null,
      orden: m.orden ? { id: m.orden.id, numero: m.orden.numeroOrden } : null,
      venta: m.venta ? { id: m.venta.id, etiqueta: etiquetaVenta(m.venta.numero) } : null,
      pase: m.pase ? { id: m.pase.id, etiqueta: etiquetaPase(m.pase.numero) } : null,
      equipoStock: m.equipoStock ?? null
    })),
    usadoEnServicios: servicios.map((s) => ({
      ...s.get({ plain: true }),
      cantidad: usadoEn.find((u) => u.servicioId === s.id)?.cantidad ?? 1
    }))
  };
}

// ── Entradas ─────────────────────────────────────────────────────────────────

/** Una compra: cada línea entra como una entrada de su producto en la sucursal elegida. */
export async function cargarEntrada(ctx: ContextoInventario, datos: NuevaEntradaInput) {
  const ids = [...new Set(datos.lineas.map((l) => l.articuloId))];
  const articulos = await Articulo.findAll({ where: { id: ids, tallerId: ctx.tallerId } });
  if (articulos.length !== ids.length) throw errores.noEncontrado('Artículo');
  if (articulos.some((a) => a.tipo === 'servicio'))
    throw errores.solicitudInvalida('Un servicio no tiene stock.');

  const fecha = datos.fecha ?? hoy();
  const creadas = await sequelize.transaction(async (transaction) => {
    const entradas: InventarioEntrada[] = [];
    for (const linea of datos.lineas) {
      entradas.push(
        await ingresarEntrada(
          ctx,
          {
            articulo: articulos.find((a) => a.id === linea.articuloId)!,
            sucursalId: ctx.sucursalId,
            cantidad: linea.cantidad,
            moneda: datos.moneda,
            costo: linea.costo,
            cotizacion: datos.cotizacion ?? null,
            fecha,
            proveedor: datos.proveedor,
            nota: datos.nota
          },
          transaction
        )
      );
    }
    return entradas;
  });
  return creadas.map((e) => ({ id: e.id, etiqueta: etiquetaEntrada(e.numero), articuloId: e.articuloId }));
}

/** Dar de baja unidades de una entrada (una carga equivocada, algo que se rompió en el cajón). Solo admin. */
export async function darDeBajaUnidades(
  ctx: ContextoInventario,
  entradaId: number,
  cantidad: number,
  motivo: string
) {
  await sequelize.transaction(async (transaction) => {
    const entrada = await InventarioEntrada.findOne({
      where: { id: entradaId, tallerId: ctx.tallerId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!entrada) throw errores.noEncontrado('Entrada');
    if (cantidad > entrada.disponible) {
      throw errores.conflicto(`De esa entrada quedan ${entrada.disponible}.`);
    }
    await entrada.update({ disponible: entrada.disponible - cantidad }, { transaction });
    await registrarMovimiento(
      ctx,
      {
        sucursalId: entrada.sucursalId,
        articuloId: entrada.articuloId,
        entradaId: entrada.id,
        tipo: 'baja',
        cantidad: -cantidad,
        nota: motivo
      },
      transaction
    );
  });
}

/**
 * Ajuste por conteo (solo admin): deja en la sucursal la cantidad que se contó.
 * Si faltan unidades salen de las entradas más viejas (como si se hubieran
 * usado); si sobran, entran como una entrada de ajuste con el costo indicado o
 * el de la última compra del producto. Todo queda en el historial con el motivo.
 */
export async function ajustarPorConteo(ctx: ContextoInventario, articuloId: number, datos: AjusteInput) {
  const articulo = await articuloDelTaller(ctx.tallerId, articuloId);
  if (articulo.tipo === 'servicio') throw errores.solicitudInvalida('Un servicio no tiene stock.');

  const resultado = await sequelize.transaction(async (transaction) => {
    const entradas = await InventarioEntrada.findAll({
      where: { articuloId, sucursalId: ctx.sucursalId, disponible: { [Op.gt]: 0 } },
      order: [
        ['fecha', 'ASC'],
        ['id', 'ASC']
      ],
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    const habia = entradas.reduce((t, e) => t + e.disponible, 0);
    const diferencia = datos.cantidadContada - habia;
    const nota = `Conteo: había ${habia}, se contaron ${datos.cantidadContada}. ${datos.motivo}`;

    if (diferencia < 0) {
      let falta = -diferencia;
      for (const entrada of entradas) {
        if (falta <= 0) break;
        const sacar = Math.min(entrada.disponible, falta);
        await entrada.update({ disponible: entrada.disponible - sacar }, { transaction });
        await registrarMovimiento(
          ctx,
          {
            sucursalId: ctx.sucursalId,
            articuloId,
            entradaId: entrada.id,
            tipo: 'ajuste',
            cantidad: -sacar,
            nota
          },
          transaction
        );
        falta -= sacar;
      }
    } else if (diferencia > 0) {
      let costo = datos.costo ?? null;
      if (!costo) {
        const ultima = await InventarioEntrada.findOne({
          where: { articuloId },
          order: [['id', 'DESC']],
          transaction
        });
        if (!ultima) {
          throw errores.solicitudInvalida(
            'El producto nunca tuvo entradas: indicá cuánto costó cada unidad que apareció.'
          );
        }
        costo = {
          moneda: ultima.moneda,
          monto: aNumero(ultima.costo),
          cotizacion: ultima.cotizacion == null ? null : aNumero(ultima.cotizacion)
        };
      }
      await ingresarEntrada(
        ctx,
        {
          articulo,
          sucursalId: ctx.sucursalId,
          cantidad: diferencia,
          moneda: costo.moneda,
          costo: costo.monto,
          cotizacion: costo.cotizacion ?? null,
          fecha: hoy(),
          nota,
          ajuste: true
        },
        transaction
      );
    }
    return { habia, contada: datos.cantidadContada, diferencia };
  });
  return { ...resultado, articulo: await detalleArticulo(ctx, articuloId) };
}

/** Los proveedores ya usados en el inventario, el último primero. */
export async function proveedoresDeInventario(tallerId: number): Promise<string[]> {
  const filas = await InventarioEntrada.findAll({
    where: { tallerId, proveedor: { [Op.ne]: null } },
    attributes: ['proveedor', [sequelize.fn('MAX', sequelize.col('id')), 'ultimo']],
    group: ['proveedor'],
    order: [[sequelize.literal('ultimo'), 'DESC']],
    limit: 100,
    raw: true
  });
  return filas.map((f) => f.proveedor).filter((p): p is string => Boolean(p?.trim()));
}

/**
 * La última cotización que usó el taller para esa moneda (en una compra, una
 * venta o un cobro): para sugerirla en los formularios y estimar la ganancia
 * de una orden presupuestada en pesos.
 *
 * De las entradas cuentan solo las compras: una que llega por un pase o por un
 * ajuste copia la cotización de una compra vieja y tiene fecha de hoy.
 */
export async function ultimaCotizacion(tallerId: number, moneda: Moneda): Promise<number | null> {
  if (moneda === 'USD') return 1;
  const [entrada, venta, orden] = await Promise.all([
    InventarioEntrada.findOne({
      where: { tallerId, moneda, origen: 'compra', cotizacion: { [Op.ne]: null } },
      attributes: ['cotizacion', 'createdAt'],
      order: [['id', 'DESC']]
    }),
    Venta.findOne({
      where: { tallerId, moneda, cotizacion: { [Op.ne]: null } },
      attributes: ['cotizacion', 'createdAt'],
      order: [['id', 'DESC']]
    }),
    Orden.findOne({
      where: { tallerId, monedaCobro: moneda, cotizacionCobro: { [Op.ne]: null } },
      attributes: ['cotizacionCobro', 'fechaEntrega'],
      order: [['fechaEntrega', 'DESC']]
    })
  ]);
  const candidatas = [
    entrada && { valor: entrada.cotizacion, fecha: entrada.createdAt },
    venta && { valor: venta.cotizacion, fecha: venta.createdAt },
    orden && { valor: orden.cotizacionCobro, fecha: orden.fechaEntrega }
  ].filter((c): c is { valor: string; fecha: Date } => Boolean(c?.valor && c.fecha));
  if (candidatas.length === 0) return null;
  candidatas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  return aNumero(candidatas[0].valor);
}
