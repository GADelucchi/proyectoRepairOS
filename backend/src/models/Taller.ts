import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

/**
 * Taller: el inquilino del sistema.
 *
 * Cada alta del registro público crea uno. Sucursales, usuarios, clientes y
 * equipos pertenecen a un taller y nunca se ven entre talleres distintos.
 */
export interface TallerAttributes {
  id: number;
  nombre: string;
  activo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TallerCreationAttributes = Optional<
  TallerAttributes,
  'id' | 'activo' | 'createdAt' | 'updatedAt'
>;

export class Taller extends Model<TallerAttributes, TallerCreationAttributes> implements TallerAttributes {
  declare id: number;
  declare nombre: string;
  declare activo: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof Taller {
    Taller.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        nombre: { type: DataTypes.STRING(150), allowNull: false },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
      },
      {
        sequelize,
        tableName: 'talleres',
        underscored: true
      }
    );
    return Taller;
  }
}
