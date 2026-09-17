import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface UsuarioSucursalAttributes {
  id: number;
  usuarioId: number;
  sucursalId: number;
}

export type UsuarioSucursalCreationAttributes = Optional<UsuarioSucursalAttributes, 'id'>;

export class UsuarioSucursal
  extends Model<UsuarioSucursalAttributes, UsuarioSucursalCreationAttributes>
  implements UsuarioSucursalAttributes
{
  public id!: number;
  public usuarioId!: number;
  public sucursalId!: number;

  static initModel(sequelize: Sequelize): typeof UsuarioSucursal {
    UsuarioSucursal.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false, field: 'sucursal_id' }
      },
      {
        sequelize,
        tableName: 'usuario_sucursales',
        underscored: true
      }
    );
    return UsuarioSucursal;
  }
}
