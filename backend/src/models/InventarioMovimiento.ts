import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize
} from 'sequelize';
import type { EquipoStock } from './EquipoStock';
import type { InventarioEntrada } from './InventarioEntrada';
import type { Orden } from './Orden';
import type { Pase } from './Pase';
import type { User } from './User';
import type { Venta } from './Venta';

export const TIPOS_MOVIMIENTO_INVENTARIO = [
  'entrada',
  'orden',
  'orden_devolucion',
  'perdida',
  'venta',
  'venta_devolucion',
  'equipo_stock',
  'equipo_stock_devolucion',
  'pase_salida',
  'pase_entrada',
  'pase_cancelado',
  'baja',
  // Corrección por conteo, hecha por un admin.
  'ajuste'
] as const;
export type TipoMovimientoInventario = (typeof TIPOS_MOVIMIENTO_INVENTARIO)[number];

/**
 * El historial de un producto en una sucursal: cada vez que cambia lo que hay,
 * cuánto (positivo entra, negativo sale), de qué entrada, por qué y quién. No
 * se edita ni se borra.
 */
export class InventarioMovimiento extends Model<
  InferAttributes<InventarioMovimiento>,
  InferCreationAttributes<InventarioMovimiento>
> {
  declare id: CreationOptional<number>;
  declare tallerId: number;
  declare sucursalId: number;
  declare articuloId: number;
  declare entradaId: number | null;
  declare tipo: TipoMovimientoInventario;
  declare cantidad: number;
  declare ordenId: CreationOptional<number | null>;
  declare ventaId: CreationOptional<number | null>;
  declare paseId: CreationOptional<number | null>;
  declare equipoStockId: CreationOptional<number | null>;
  declare usuarioId: number | null;
  declare nota: CreationOptional<string | null>;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare entrada?: NonAttribute<InventarioEntrada | null>;
  declare usuario?: NonAttribute<User | null>;
  declare orden?: NonAttribute<Orden | null>;
  declare venta?: NonAttribute<Venta | null>;
  declare pase?: NonAttribute<Pase | null>;
  declare equipoStock?: NonAttribute<EquipoStock | null>;

  static initModel(sequelize: Sequelize): typeof InventarioMovimiento {
    InventarioMovimiento.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false },
        articuloId: { type: DataTypes.INTEGER, allowNull: false },
        entradaId: { type: DataTypes.INTEGER, allowNull: true },
        tipo: { type: DataTypes.ENUM(...TIPOS_MOVIMIENTO_INVENTARIO), allowNull: false },
        cantidad: { type: DataTypes.INTEGER, allowNull: false },
        ordenId: { type: DataTypes.INTEGER, allowNull: true },
        ventaId: { type: DataTypes.INTEGER, allowNull: true },
        paseId: { type: DataTypes.INTEGER, allowNull: true },
        equipoStockId: { type: DataTypes.INTEGER, allowNull: true },
        usuarioId: { type: DataTypes.INTEGER, allowNull: true },
        nota: { type: DataTypes.STRING(255), allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'inventario_movimientos', underscored: true }
    );
    return InventarioMovimiento;
  }
}
