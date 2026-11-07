import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Moneda } from '../shared/utils/dinero';
import type { User } from './User';

/**
 * Un costo que se le agregó a un equipo del stock: "Batería US$ 35". Suma al
 * costo del equipo y baja la ganancia de su venta. No se borra: se anula.
 */
export interface EquipoStockCostoAttributes {
  id: number;
  tallerId: number;
  equipoStockId: number;
  concepto: string;
  fecha: string;
  moneda: Moneda;
  monto: string;
  cotizacion?: string | null;
  montoUsd: string;
  usuarioId: number;
  anuladoEn?: Date | null;
  anuladoPorId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EquipoStockCostoCreationAttributes = Optional<
  EquipoStockCostoAttributes,
  'id' | 'cotizacion' | 'anuladoEn' | 'anuladoPorId' | 'createdAt' | 'updatedAt'
>;

export class EquipoStockCosto
  extends Model<EquipoStockCostoAttributes, EquipoStockCostoCreationAttributes>
  implements EquipoStockCostoAttributes
{
  declare id: number;
  declare tallerId: number;
  declare equipoStockId: number;
  declare concepto: string;
  /** El día del gasto (YYYY-MM-DD). */
  declare fecha: string;
  declare moneda: Moneda;
  declare monto: string;
  /** 1 US$ en la moneda del costo ese día. Vacío si es en dólares. */
  declare cotizacion: string | null;
  /** El costo pasado a dólares, que es como se suma al equipo. */
  declare montoUsd: string;
  declare usuarioId: number;
  declare anuladoEn: Date | null;
  declare anuladoPorId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare usuario?: NonAttribute<User>;
  declare anuladoPor?: NonAttribute<User>;

  static initModel(sequelize: Sequelize): typeof EquipoStockCosto {
    EquipoStockCosto.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        equipoStockId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_stock_id' },
        concepto: { type: DataTypes.STRING(150), allowNull: false },
        fecha: { type: DataTypes.DATEONLY, allowNull: false },
        moneda: { type: DataTypes.STRING(3), allowNull: false },
        monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        cotizacion: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
        montoUsd: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'monto_usd' },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        anuladoEn: { type: DataTypes.DATE, allowNull: true, field: 'anulado_en' },
        anuladoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'anulado_por_id' }
      },
      {
        sequelize,
        tableName: 'equipo_stock_costos',
        underscored: true
      }
    );
    return EquipoStockCosto;
  }
}
