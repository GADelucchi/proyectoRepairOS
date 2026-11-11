import { Op } from 'sequelize';
import { EquipoStock, Sucursal, Taller } from '../../models';
import type { CondicionEquipo } from '../../models/EquipoStock';
import { HttpError } from '../../shared/http/http-error';
import { aNumero } from '../../shared/utils/dinero';
import { etiquetaNumero } from '../stock/stock.service';

/** Un catálogo más grande no se lee; el listado interno del stock usa el mismo tope. */
const LIMITE_CATALOGO = 500;

export interface FiltrosCatalogo {
  condicion?: CondicionEquipo;
  marca?: string;
}

/** Lo lee el público tal cual (la página del catálogo lo muestra). */
export const catalogoNoEncontrado = () =>
  new HttpError(404, 'Este catálogo no existe o el taller todavía no lo publicó.');

/** 128 → "128 GB" · 1024 → "1 TB". */
export function memoriaLegible(gb: number | null): string | null {
  if (!gb) return null;
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

type EquipoDelCatalogo = Pick<
  EquipoStock,
  | 'numero'
  | 'marca'
  | 'modelo'
  | 'color'
  | 'almacenamientoGb'
  | 'condicion'
  | 'bateria'
  | 'monedaPrecio'
  | 'precio'
> & { sucursal?: Pick<Sucursal, 'nombre'> };

/**
 * Lo que ve el público de un equipo. Lista blanca a propósito: costo,
 * proveedor, IMEI, número de serie y observaciones nunca salen de acá.
 */
export function equipoPublico(e: EquipoDelCatalogo) {
  return {
    // Con este número el cliente pregunta por el equipo en el mostrador.
    codigo: etiquetaNumero(e.numero),
    marca: e.marca,
    modelo: e.modelo,
    color: e.color ?? null,
    memoria: memoriaLegible(e.almacenamientoGb ?? null),
    almacenamientoGb: e.almacenamientoGb ?? null,
    condicion: e.condicion,
    // La salud de la batería solo dice algo en un usado.
    bateria: e.condicion === 'usado' ? (e.bateria ?? null) : null,
    precio: aNumero(e.precio),
    moneda: e.monedaPrecio,
    sucursal: e.sucursal?.nombre ?? null
  };
}

/**
 * El stock que un taller publica para sus clientes: solo lo que se puede
 * comprar hoy (disponible, con precio de venta, en una sucursal activa). Lo
 * reservado o señado ya tiene dueño y no se muestra.
 *
 * Si el taller no existe o no publicó su catálogo, la respuesta es la misma:
 * no se revela qué códigos son de un taller.
 */
export async function catalogoPublico(codigoTaller: string, filtros: FiltrosCatalogo) {
  const taller = await Taller.findOne({
    where: { codigoPublico: codigoTaller, activo: true, catalogoPublico: true },
    attributes: ['id', 'nombre', 'pais']
  });
  if (!taller) throw catalogoNoEncontrado();

  const equipos = await EquipoStock.findAll({
    where: {
      tallerId: taller.id,
      estado: 'disponible',
      precio: { [Op.ne]: null },
      monedaPrecio: { [Op.ne]: null },
      ...(filtros.condicion && { condicion: filtros.condicion }),
      ...(filtros.marca && { marca: filtros.marca })
    },
    attributes: [
      'numero',
      'marca',
      'modelo',
      'color',
      'almacenamientoGb',
      'condicion',
      'bateria',
      'monedaPrecio',
      'precio'
    ],
    include: [
      {
        model: Sucursal,
        as: 'sucursal',
        attributes: ['id', 'nombre', 'direccion', 'telefono'],
        where: { activo: true }
      }
    ],
    order: [
      ['marca', 'ASC'],
      ['modelo', 'ASC'],
      ['precio', 'ASC']
    ],
    limit: LIMITE_CATALOGO
  });

  // Dónde ver o comprar cada equipo: la dirección y el teléfono ya salen en el remito.
  const sucursales = new Map<number, Sucursal>();
  for (const e of equipos) if (e.sucursal) sucursales.set(e.sucursal.id, e.sucursal);

  return {
    taller: taller.nombre,
    // Para armar el link de WhatsApp con el prefijo del país.
    pais: taller.pais,
    generado: new Date().toISOString(),
    total: equipos.length,
    sucursales: [...sucursales.values()].map((s) => ({
      nombre: s.nombre,
      direccion: s.direccion,
      telefono: s.telefono
    })),
    equipos: equipos.map(equipoPublico)
  };
}
