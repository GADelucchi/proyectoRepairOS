import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Articulo } from './Articulo';
import type { EquipoStock } from './EquipoStock';
import type { InventarioConsumo } from './InventarioConsumo';
import type { Venta } from './Venta';

/**
 * Un renglón de la venta: un equipo del stock, o unidades de un artículo del
 * inventario (un accesorio, un repuesto suelto). El precio es por unidad, en la
 * moneda de la venta.
 */
export interface VentaItemAttributes {
  id: number;
  ventaId: number;
  equipoStockId?: number | null;
  articuloId?: number | null;
  cantidad?: number;
  precio: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VentaItemCreationAttributes = Optional<
  VentaItemAttributes,
  'id' | 'equipoStockId' | 'articuloId' | 'cantidad' | 'createdAt' | 'updatedAt'
>;

export class VentaItem
  extends Model<VentaItemAttributes, VentaItemCreationAttributes>
  implements VentaItemAttributes
{
  declare id: number;
  declare ventaId: number;
  declare equipoStockId: number | null;
  declare articuloId: number | null;
  /** Siempre 1 para un equipo del stock. */
  declare cantidad: number;
  /** Por unidad, en la moneda de la venta: el precio de lista se puede cambiar al vender. */
  declare precio: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare equipo?: NonAttribute<EquipoStock>;
  declare venta?: NonAttribute<Venta>;
  declare articulo?: NonAttribute<Articulo | null>;
  declare consumos?: NonAttribute<InventarioConsumo[]>;

  static initModel(sequelize: Sequelize): typeof VentaItem {
    VentaItem.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        ventaId: { type: DataTypes.INTEGER, allowNull: false, field: 'venta_id' },
        equipoStockId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipo_stock_id' },
        articuloId: { type: DataTypes.INTEGER, allowNull: true, field: 'articulo_id' },
        cantidad: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
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
