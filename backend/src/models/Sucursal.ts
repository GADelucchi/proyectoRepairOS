import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { User } from './User';

export interface SucursalAttributes {
  id: number;
  tallerId: number;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  activo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SucursalCreationAttributes = Optional<
  SucursalAttributes,
  'id' | 'activo' | 'direccion' | 'telefono' | 'createdAt' | 'updatedAt'
>;

export class Sucursal
  extends Model<SucursalAttributes, SucursalCreationAttributes>
  implements SucursalAttributes
{
  declare id: number;
  declare tallerId: number;
  declare nombre: string;
  declare direccion: string | null;
  declare telefono: string | null;
  declare activo: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare usuarios?: NonAttribute<User[]>;

  static initModel(sequelize: Sequelize): typeof Sucursal {
    Sucursal.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        nombre: { type: DataTypes.STRING(150), allowNull: false },
        direccion: { type: DataTypes.STRING(255), allowNull: true },
        telefono: { type: DataTypes.STRING(50), allowNull: true },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
      },
      {
        sequelize,
        tableName: 'sucursales',
        underscored: true
      }
    );
    return Sucursal;
  }
}
