import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize
} from 'sequelize';
import { TIPOS_ARTICULO, type TipoArticulo } from './Articulo';

/**
 * El tercer nivel del inventario, que arma cada taller: dentro de Repuestos,
 * "Baterías", "Módulos"; dentro de Servicios, "Pantallas". Los dos primeros
 * niveles (producto o servicio; repuesto o accesorio) son fijos.
 */
export class InventarioCategoria extends Model<
  InferAttributes<InventarioCategoria>,
  InferCreationAttributes<InventarioCategoria>
> {
  declare id: CreationOptional<number>;
  declare tallerId: number;
  declare grupo: TipoArticulo;
  declare nombre: string;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): typeof InventarioCategoria {
    InventarioCategoria.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false },
        grupo: { type: DataTypes.ENUM(...TIPOS_ARTICULO), allowNull: false },
        nombre: { type: DataTypes.STRING(100), allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'inventario_categorias', underscored: true }
    );
    return InventarioCategoria;
  }
}
