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
import type { EquipoStock } from './EquipoStock';
import type { InventarioEntrada } from './InventarioEntrada';
import type { Sucursal } from './Sucursal';
import type { User } from './User';

/**
 * - `en_camino`: salió de la sucursal origen y todavía no llegó. No está en el
 *   stock de ninguna de las dos.
 * - `recibido`: la sucursal destino confirmó que llegó y ya es parte de su stock.
 * - `cancelado`: no se mandó; lo que llevaba volvió a la sucursal origen.
 */
export const ESTADOS_PASE = ['en_camino', 'recibido', 'cancelado'] as const;
export type EstadoPase = (typeof ESTADOS_PASE)[number];

/** Un envío de repuestos, accesorios o equipos del stock de una sucursal a otra. */
export class Pase extends Model<InferAttributes<Pase>, InferCreationAttributes<Pase>> {
  declare id: CreationOptional<number>;
  declare tallerId: number;
  /** "P-0005": numerado por taller. */
  declare numero: number;
  declare sucursalOrigenId: number;
  declare sucursalDestinoId: number;
  declare estado: CreationOptional<EstadoPase>;
  declare nota: CreationOptional<string | null>;
  declare enviadoPorId: number | null;
  declare recibidoPorId: CreationOptional<number | null>;
  declare recibidoEn: CreationOptional<Date | null>;
  declare canceladoPorId: CreationOptional<number | null>;
  declare canceladoEn: CreationOptional<Date | null>;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare items?: NonAttribute<PaseItem[]>;
  declare sucursalOrigen?: NonAttribute<Sucursal>;
  declare sucursalDestino?: NonAttribute<Sucursal>;
  declare enviadoPor?: NonAttribute<User | null>;
  declare recibidoPor?: NonAttribute<User | null>;
  declare canceladoPor?: NonAttribute<User | null>;

  static initModel(sequelize: Sequelize): typeof Pase {
    Pase.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false },
        numero: { type: DataTypes.INTEGER, allowNull: false },
        sucursalOrigenId: { type: DataTypes.INTEGER, allowNull: false },
        sucursalDestinoId: { type: DataTypes.INTEGER, allowNull: false },
        estado: { type: DataTypes.ENUM(...ESTADOS_PASE), allowNull: false, defaultValue: 'en_camino' },
        nota: { type: DataTypes.STRING(255), allowNull: true },
        enviadoPorId: { type: DataTypes.INTEGER, allowNull: true },
        recibidoPorId: { type: DataTypes.INTEGER, allowNull: true },
        recibidoEn: { type: DataTypes.DATE, allowNull: true },
        canceladoPorId: { type: DataTypes.INTEGER, allowNull: true },
        canceladoEn: { type: DataTypes.DATE, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'pases', underscored: true }
    );
    return Pase;
  }
}

/**
 * Lo que lleva un pase: unidades de una entrada de un producto, o un equipo
 * del stock. Las unidades conservan el costo de su entrada.
 */
export class PaseItem extends Model<InferAttributes<PaseItem>, InferCreationAttributes<PaseItem>> {
  declare id: CreationOptional<number>;
  declare paseId: number;
  declare articuloId: number | null;
  declare entradaId: number | null;
  declare equipoStockId: number | null;
  declare cantidad: number;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare articulo?: NonAttribute<Articulo | null>;
  declare entrada?: NonAttribute<InventarioEntrada | null>;
  declare equipo?: NonAttribute<EquipoStock | null>;

  static initModel(sequelize: Sequelize): typeof PaseItem {
    PaseItem.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        paseId: { type: DataTypes.INTEGER, allowNull: false },
        articuloId: { type: DataTypes.INTEGER, allowNull: true },
        entradaId: { type: DataTypes.INTEGER, allowNull: true },
        equipoStockId: { type: DataTypes.INTEGER, allowNull: true },
        cantidad: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'pase_items', underscored: true }
    );
    return PaseItem;
  }
}
