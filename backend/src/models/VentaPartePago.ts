import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { CONDICIONES_EQUIPO, CondicionEquipo } from './EquipoStock';

/**
 * Un equipo que deja el cliente como parte de pago. Queda anotado con la venta y
 * entra al stock recién al completarla: si la reserva se cancela, el cliente
 * nunca lo entregó.
 */
export interface VentaPartePagoAttributes {
  id: number;
  ventaId: number;
  marca: string;
  modelo: string;
  color?: string | null;
  almacenamientoGb?: number | null;
  condicion: CondicionEquipo;
  bateria?: number | null;
  numeroSerie?: string | null;
  imei?: string | null;
  imei2?: string | null;
  monto: string;
  observaciones?: string | null;
  equipoStockId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VentaPartePagoCreationAttributes = Optional<
  VentaPartePagoAttributes,
  | 'id'
  | 'color'
  | 'almacenamientoGb'
  | 'bateria'
  | 'numeroSerie'
  | 'imei'
  | 'imei2'
  | 'observaciones'
  | 'equipoStockId'
  | 'createdAt'
  | 'updatedAt'
>;

export class VentaPartePago
  extends Model<VentaPartePagoAttributes, VentaPartePagoCreationAttributes>
  implements VentaPartePagoAttributes
{
  declare id: number;
  declare ventaId: number;
  declare marca: string;
  declare modelo: string;
  declare color: string | null;
  declare almacenamientoGb: number | null;
  declare condicion: CondicionEquipo;
  declare bateria: number | null;
  declare numeroSerie: string | null;
  declare imei: string | null;
  declare imei2: string | null;
  /** Lo que se le toma, en la moneda de la venta. Es el costo con el que entra al stock. */
  declare monto: string;
  declare observaciones: string | null;
  /** El equipo del stock que se creó al completar la venta. */
  declare equipoStockId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof VentaPartePago {
    VentaPartePago.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        ventaId: { type: DataTypes.INTEGER, allowNull: false, field: 'venta_id' },
        marca: { type: DataTypes.STRING(100), allowNull: false },
        modelo: { type: DataTypes.STRING(100), allowNull: false },
        color: { type: DataTypes.STRING(50), allowNull: true },
        almacenamientoGb: { type: DataTypes.INTEGER, allowNull: true, field: 'almacenamiento_gb' },
        condicion: { type: DataTypes.ENUM(...CONDICIONES_EQUIPO), allowNull: false, defaultValue: 'usado' },
        bateria: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
        numeroSerie: { type: DataTypes.STRING(150), allowNull: true, field: 'numero_serie' },
        imei: { type: DataTypes.STRING(15), allowNull: true },
        imei2: { type: DataTypes.STRING(15), allowNull: true },
        monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        observaciones: { type: DataTypes.TEXT, allowNull: true },
        equipoStockId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipo_stock_id' }
      },
      {
        sequelize,
        tableName: 'venta_partes_pago',
        underscored: true
      }
    );
    return VentaPartePago;
  }
}
