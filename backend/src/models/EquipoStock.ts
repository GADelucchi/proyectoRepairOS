import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { Moneda } from '../shared/utils/dinero';
import type { Sucursal } from './Sucursal';
import type { User } from './User';

export const CONDICIONES_EQUIPO = ['nuevo', 'usado'] as const;
export type CondicionEquipo = (typeof CONDICIONES_EQUIPO)[number];

/**
 * Disponible se puede vender. Reservado: apartado sin pago hasta una fecha.
 * Señado: el cliente pagó una parte. Vendido: ya no está en el stock. Baja: se
 * sacó del stock (una carga equivocada, un equipo roto); nunca se borra la fila.
 */
export const ESTADOS_STOCK = ['disponible', 'reservado', 'senado', 'vendido', 'baja'] as const;
export type EstadoStock = (typeof ESTADOS_STOCK)[number];

/**
 * Una unidad en venta, con su propio costo. No es un `Equipo`: aquellos son los
 * de los clientes que entran a reparar.
 */
export interface EquipoStockAttributes {
  id: number;
  tallerId: number;
  sucursalId: number;
  numero: number;
  marca: string;
  modelo: string;
  color?: string | null;
  almacenamientoGb?: number | null;
  condicion: CondicionEquipo;
  bateria?: number | null;
  numeroSerie?: string | null;
  imei?: string | null;
  imei2?: string | null;
  fechaCompra: string;
  proveedor?: string | null;
  monedaCosto: Moneda;
  costo: string;
  cotizacionCosto?: string | null;
  costoReparacionesUsd?: string;
  monedaPrecio?: Moneda | null;
  precio?: string | null;
  estado: EstadoStock;
  observaciones?: string | null;
  cargadoPorId?: number | null;
  bajaEn?: Date | null;
  bajaPorId?: number | null;
  motivoBaja?: string | null;
  recibidoEnVentaId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EquipoStockCreationAttributes = Optional<
  EquipoStockAttributes,
  | 'id'
  | 'color'
  | 'almacenamientoGb'
  | 'bateria'
  | 'numeroSerie'
  | 'imei'
  | 'imei2'
  | 'proveedor'
  | 'cotizacionCosto'
  | 'costoReparacionesUsd'
  | 'monedaPrecio'
  | 'precio'
  | 'estado'
  | 'observaciones'
  | 'cargadoPorId'
  | 'bajaEn'
  | 'bajaPorId'
  | 'motivoBaja'
  | 'recibidoEnVentaId'
  | 'createdAt'
  | 'updatedAt'
>;

export class EquipoStock
  extends Model<EquipoStockAttributes, EquipoStockCreationAttributes>
  implements EquipoStockAttributes
{
  declare id: number;
  declare tallerId: number;
  /** Dónde está el equipo. */
  declare sucursalId: number;
  /** Correlativo por taller: se muestra como #0042. */
  declare numero: number;
  declare marca: string;
  declare modelo: string;
  declare color: string | null;
  /** 1 TB se guarda como 1024. */
  declare almacenamientoGb: number | null;
  declare condicion: CondicionEquipo;
  /** Salud de la batería en %, solo en usados. */
  declare bateria: number | null;
  declare numeroSerie: string | null;
  declare imei: string | null;
  declare imei2: string | null;
  declare fechaCompra: string;
  declare proveedor: string | null;
  declare monedaCosto: Moneda;
  // DECIMAL vuelve como string desde Sequelize.
  declare costo: string;
  /** Cuánto valía 1 US$ en la moneda del costo el día de compra. Vacío si el costo es en dólares. */
  declare cotizacionCosto: string | null;
  /** Lo que se le agregó después de comprarlo (reparaciones, repuestos), en US$. Ver EquipoStockCosto. */
  declare costoReparacionesUsd: string;
  /** Precio de lista: se puede cambiar al vender. */
  declare monedaPrecio: Moneda | null;
  declare precio: string | null;
  declare estado: EstadoStock;
  declare observaciones: string | null;
  declare cargadoPorId: number | null;
  declare bajaEn: Date | null;
  declare bajaPorId: number | null;
  declare motivoBaja: string | null;
  /** La venta en la que el cliente lo dejó como parte de pago. */
  declare recibidoEnVentaId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Asociaciones: solo están cargadas cuando la consulta las incluye.
  declare sucursal?: Sucursal;
  declare cargadoPor?: User;

  static initModel(sequelize: Sequelize): typeof EquipoStock {
    EquipoStock.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false, field: 'sucursal_id' },
        numero: { type: DataTypes.INTEGER, allowNull: false },
        marca: { type: DataTypes.STRING(100), allowNull: false },
        modelo: { type: DataTypes.STRING(100), allowNull: false },
        color: { type: DataTypes.STRING(50), allowNull: true },
        almacenamientoGb: { type: DataTypes.INTEGER, allowNull: true, field: 'almacenamiento_gb' },
        condicion: { type: DataTypes.ENUM(...CONDICIONES_EQUIPO), allowNull: false },
        bateria: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
        numeroSerie: { type: DataTypes.STRING(150), allowNull: true, field: 'numero_serie' },
        imei: { type: DataTypes.STRING(15), allowNull: true },
        imei2: { type: DataTypes.STRING(15), allowNull: true },
        fechaCompra: { type: DataTypes.DATEONLY, allowNull: false, field: 'fecha_compra' },
        proveedor: { type: DataTypes.STRING(150), allowNull: true },
        monedaCosto: { type: DataTypes.STRING(3), allowNull: false, field: 'moneda_costo' },
        costo: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        cotizacionCosto: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'cotizacion_costo' },
        costoReparacionesUsd: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          field: 'costo_reparaciones_usd'
        },
        monedaPrecio: { type: DataTypes.STRING(3), allowNull: true, field: 'moneda_precio' },
        precio: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
        estado: {
          type: DataTypes.ENUM(...ESTADOS_STOCK),
          allowNull: false,
          defaultValue: 'disponible'
        },
        observaciones: { type: DataTypes.TEXT, allowNull: true },
        cargadoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'cargado_por_id' },
        bajaEn: { type: DataTypes.DATE, allowNull: true, field: 'baja_en' },
        bajaPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'baja_por_id' },
        motivoBaja: { type: DataTypes.STRING(255), allowNull: true, field: 'motivo_baja' },
        recibidoEnVentaId: { type: DataTypes.INTEGER, allowNull: true, field: 'recibido_en_venta_id' }
      },
      {
        sequelize,
        tableName: 'equipos_stock',
        underscored: true
      }
    );
    return EquipoStock;
  }
}
