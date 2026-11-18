import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize
} from 'sequelize';
import type { User } from './User';

/**
 * Un servicio del inventario que se agregó a una orden. Sus repuestos se
 * descuentan del stock como consumos de la orden ligados a esta fila. El
 * nombre queda copiado: si después se cambia el servicio, la orden muestra lo
 * que se hizo.
 */
export class OrdenServicio extends Model<
  InferAttributes<OrdenServicio>,
  InferCreationAttributes<OrdenServicio>
> {
  declare id: CreationOptional<number>;
  declare tallerId: number;
  declare ordenId: number;
  declare servicioId: number;
  declare nombre: string;
  declare usuarioId: number | null;
  declare readonly createdAt: CreationOptional<Date>;
  declare readonly updatedAt: CreationOptional<Date>;

  declare usuario?: NonAttribute<User | null>;

  static initModel(sequelize: Sequelize): typeof OrdenServicio {
    OrdenServicio.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false },
        ordenId: { type: DataTypes.INTEGER, allowNull: false },
        servicioId: { type: DataTypes.INTEGER, allowNull: false },
        nombre: { type: DataTypes.STRING(150), allowNull: false },
        usuarioId: { type: DataTypes.INTEGER, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      },
      { sequelize, tableName: 'orden_servicios', underscored: true }
    );
    return OrdenServicio;
  }
}
