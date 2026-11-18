import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize
} from 'sequelize';
import type { Moneda } from '../shared/utils/dinero';
import type { Articulo } from './Articulo';
import type { Sucursal } from './Sucursal';
import type { User } from './User';

/** `ajuste`: unidades que aparecieron al contar (las cargó un admin con un ajuste por conteo). */
export const ORIGENES_ENTRADA = ['compra', 'pase', 'ajuste'] as const;
export type OrigenEntrada = (typeof ORIGENES_ENTRADA)[number];

/**
 * Una compra de un producto en una sucursal: "10 módulos a US$ 100 el 12/10".
 * Cada unidad conserva ese costo; `disponible` es lo que queda de esta entrada.
 * Lo que llega por un pase entra como otra entrada en la sucursal destino, con
 * el mismo costo y la misma fecha (así se sigue usando primero lo más viejo).
 */
export class InventarioEntrada extends Model<
  InferAttributes<InventarioEntrada>,
  InferCreationAttributes<InventarioEntrada>
> {
  declare id: CreationOptional<number>;
  declare tallerId: number;
  declare sucursalId: number;
  declare articuloId: number;
  /** "E-0041": numerado por taller. */
  declare numero: number;
  declare origen: CreationOptional<OrigenEntrada>;
  declare paseId: CreationOptional<number | null>;
  declare entradaOrigenId: CreationOptional<number | null>;
  /** El día de la compra (YYYY-MM-DD). */
  declare fecha: string;
  declare cantidad: number;
  declare disponible: number;
  declare moneda: Moneda;
  /** Lo que costó cada unidad, en `moneda`. */
  declare costo: string;
  /** 1 US$ en `moneda` ese día. Vacío si es en dólares. */
  declare cotizacion: CreationOptional<string | null>;
  /** Una unidad en dólares: es lo que suma al costo de una orden o una venta. */
  declare costoUsd: string;
  declare proveedor: CreationOptional<string | null>;
  declare nota: CreationOptional<string | null>;
  declare cargadaPorId: CreationOptional<number | null>;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare articulo?: NonAttribute<Articulo>;
  declare sucursal?: NonAttribute<Sucursal>;
  declare cargadaPor?: NonAttribute<User | null>;
  declare entradaOrigen?: NonAttribute<InventarioEntrada | null>;

  static initModel(sequelize: Sequelize): typeof InventarioEntrada {
    InventarioEntrada.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false },
        articuloId: { type: DataTypes.INTEGER, allowNull: false },
        numero: { type: DataTypes.INTEGER, allowNull: false },
        origen: { type: DataTypes.ENUM(...ORIGENES_ENTRADA), allowNull: false, defaultValue: 'compra' },
        paseId: { type: DataTypes.INTEGER, allowNull: true },
        entradaOrigenId: { type: DataTypes.INTEGER, allowNull: true },
        fecha: { type: DataTypes.DATEONLY, allowNull: false },
        cantidad: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        disponible: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        moneda: { type: DataTypes.STRING(3), allowNull: false },
        costo: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        cotizacion: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
        costoUsd: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
        proveedor: { type: DataTypes.STRING(150), allowNull: true },
        nota: { type: DataTypes.STRING(255), allowNull: true },
        cargadaPorId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'inventario_entradas', underscored: true }
    );
    return InventarioEntrada;
  }
}
