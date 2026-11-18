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

/** Un repuesto que lleva un servicio, y cuántos. Al agregar el servicio a una orden se descuentan. */
export class ServicioRepuesto extends Model<
  InferAttributes<ServicioRepuesto>,
  InferCreationAttributes<ServicioRepuesto>
> {
  declare id: CreationOptional<number>;
  declare servicioId: number;
  declare repuestoId: number;
  declare cantidad: number;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare repuesto?: NonAttribute<Articulo>;

  static initModel(sequelize: Sequelize): typeof ServicioRepuesto {
    ServicioRepuesto.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        servicioId: { type: DataTypes.INTEGER, allowNull: false },
        repuestoId: { type: DataTypes.INTEGER, allowNull: false },
        cantidad: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'servicio_repuestos', underscored: true }
    );
    return ServicioRepuesto;
  }
}
