import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { EquipoStock } from './EquipoStock';
import type { Venta } from './Venta';

/** Un equipo del stock que se lleva el cliente, al precio de esta venta. */
export interface VentaItemAttributes {
  id: number;
  ventaId: number;
  equipoStockId: number;
  precio: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VentaItemCreationAttributes = Optional<VentaItemAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class VentaItem
  extends Model<VentaItemAttributes, VentaItemCreationAttributes>
  implements VentaItemAttributes
{
  declare id: number;
  declare ventaId: number;
  declare equipoStockId: number;
  /** En la moneda de la venta: el precio de lista se puede cambiar al vender. */
  declare precio: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare equipo?: NonAttribute<EquipoStock>;
  declare venta?: NonAttribute<Venta>;

  static initModel(sequelize: Sequelize): typeof VentaItem {
    VentaItem.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        ventaId: { type: DataTypes.INTEGER, allowNull: false, field: 'venta_id' },
        equipoStockId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_stock_id' },
        precio: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
      },
      {
        sequelize,
        tableName: 'venta_items',
        underscored: true
      }
    );
    return VentaItem;
  }
}
