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
import type { InventarioCategoria } from './InventarioCategoria';
import type { ServicioRepuesto } from './ServicioRepuesto';

/**
 * Repuesto y accesorio son productos: tienen stock. El servicio es lo que se
 * cobra (un cambio de módulo) y puede llevar repuestos.
 */
export const TIPOS_ARTICULO = ['repuesto', 'accesorio', 'servicio'] as const;
export type TipoArticulo = (typeof TIPOS_ARTICULO)[number];

export const TIPOS_PRODUCTO: readonly TipoArticulo[] = ['repuesto', 'accesorio'];

/** Las posiciones de los precios: cada taller les pone nombre (Lista, Efectivo, Tarjeta). */
export const POSICIONES_PRECIO = [1, 2, 3] as const;

/**
 * Un repuesto, un accesorio o un servicio del taller. Lo que hay de cada
 * producto y lo que costó vive en sus entradas (`InventarioEntrada`), por
 * sucursal: acá solo los datos y los precios.
 */
export class Articulo extends Model<InferAttributes<Articulo>, InferCreationAttributes<Articulo>> {
  declare id: CreationOptional<number>;
  declare tallerId: number;
  declare tipo: TipoArticulo;
  declare categoriaId: number | null;
  /** "R-0012": lo genera el sistema y se puede cambiar. Único por taller. */
  declare codigo: string;
  declare codigoBarras: CreationOptional<string | null>;
  declare nombre: string;
  /** Por sucursal: si una queda por debajo, se avisa. 0 es sin aviso. */
  declare stockMinimo: CreationOptional<number>;
  declare precio1: CreationOptional<string | null>;
  declare moneda1: CreationOptional<Moneda | null>;
  declare precio2: CreationOptional<string | null>;
  declare moneda2: CreationOptional<Moneda | null>;
  declare precio3: CreationOptional<string | null>;
  declare moneda3: CreationOptional<Moneda | null>;
  /** Archivado: no aparece para usar ni vender, pero sigue en el historial. */
  declare activo: CreationOptional<boolean>;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare categoria?: NonAttribute<InventarioCategoria | null>;
  declare repuestos?: NonAttribute<ServicioRepuesto[]>;

  static initModel(sequelize: Sequelize): typeof Articulo {
    // Un objeto nuevo por columna: Sequelize anota el nombre de la columna en la definición.
    const precio = () => ({ type: DataTypes.DECIMAL(12, 2), allowNull: true });
    const moneda = () => ({ type: DataTypes.STRING(3), allowNull: true });
    Articulo.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false },
        tipo: { type: DataTypes.ENUM(...TIPOS_ARTICULO), allowNull: false },
        categoriaId: { type: DataTypes.INTEGER, allowNull: true },
        codigo: { type: DataTypes.STRING(30), allowNull: false },
        codigoBarras: { type: DataTypes.STRING(64), allowNull: true },
        nombre: { type: DataTypes.STRING(150), allowNull: false },
        stockMinimo: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        precio1: precio(),
        moneda1: moneda(),
        precio2: precio(),
        moneda2: moneda(),
        precio3: precio(),
        moneda3: moneda(),
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'articulos', underscored: true }
    );
    return Articulo;
  }
}
