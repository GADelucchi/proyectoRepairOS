import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize
} from 'sequelize';
import type { Articulo } from './Articulo';
import type { InventarioEntrada } from './InventarioEntrada';
import type { User } from './User';

export const ORIGENES_CONSUMO = ['orden', 'venta', 'equipo_stock'] as const;
export type OrigenConsumo = (typeof ORIGENES_CONSUMO)[number];

/**
 * - `usado`: salió del stock y es costo de lo que lo usó.
 * - `devuelto`: volvió a su entrada (se sacó de la orden, se canceló la venta).
 * - `perdido`: se rompió al usarlo. No vuelve, y sigue siendo costo.
 */
export const ESTADOS_CONSUMO = ['usado', 'devuelto', 'perdido'] as const;
export type EstadoConsumo = (typeof ESTADOS_CONSUMO)[number];

/** Que siguen contando como costo. */
export const CONSUMO_CON_COSTO: readonly EstadoConsumo[] = ['usado', 'perdido'];

/**
 * Unidades de una entrada que se usaron en una orden, una venta o un equipo del
 * stock. Una misma línea puede necesitar dos filas si las unidades salen de
 * dos entradas con costos distintos.
 */
export class InventarioConsumo extends Model<
  InferAttributes<InventarioConsumo>,
  InferCreationAttributes<InventarioConsumo>
> {
  declare id: CreationOptional<number>;
  declare tallerId: number;
  declare sucursalId: number;
  declare articuloId: number;
  declare entradaId: number;
  declare cantidad: number;
  /** Costo de una unidad en dólares, el de su entrada. */
  declare costoUsd: string;
  declare origen: OrigenConsumo;
  declare ordenId: CreationOptional<number | null>;
  declare ordenServicioId: CreationOptional<number | null>;
  declare ventaItemId: CreationOptional<number | null>;
  declare equipoStockCostoId: CreationOptional<number | null>;
  declare estado: CreationOptional<EstadoConsumo>;
  declare motivo: CreationOptional<string | null>;
  declare usuarioId: CreationOptional<number | null>;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare articulo?: NonAttribute<Articulo>;
  declare entrada?: NonAttribute<InventarioEntrada>;
  declare usuario?: NonAttribute<User | null>;

  static initModel(sequelize: Sequelize): typeof InventarioConsumo {
    InventarioConsumo.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false },
        articuloId: { type: DataTypes.INTEGER, allowNull: false },
        entradaId: { type: DataTypes.INTEGER, allowNull: false },
        cantidad: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        costoUsd: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
        origen: { type: DataTypes.ENUM(...ORIGENES_CONSUMO), allowNull: false },
        ordenId: { type: DataTypes.INTEGER, allowNull: true },
        ordenServicioId: { type: DataTypes.INTEGER, allowNull: true },
        ventaItemId: { type: DataTypes.INTEGER, allowNull: true },
        equipoStockCostoId: { type: DataTypes.INTEGER, allowNull: true },
        estado: { type: DataTypes.ENUM(...ESTADOS_CONSUMO), allowNull: false, defaultValue: 'usado' },
        motivo: { type: DataTypes.STRING(255), allowNull: true },
        usuarioId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'inventario_consumos', underscored: true }
    );
    return InventarioConsumo;
  }
}
