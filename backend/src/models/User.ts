import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type RolUsuario = 'admin' | 'tecnico';

export interface UserAttributes {
  id: number;
  tallerId: number;
  nombre: string;
  apellido: string;
  email: string;
  passwordHash: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<UserAttributes, 'id' | 'activo' | 'createdAt' | 'updatedAt'>;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public tallerId!: number;
  public nombre!: string;
  public apellido!: string;
  public email!: string;
  public passwordHash!: string;
  public rol!: RolUsuario;
  public activo!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        nombre: { type: DataTypes.STRING(100), allowNull: false },
        apellido: { type: DataTypes.STRING(100), allowNull: false },
        email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
        passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
        rol: { type: DataTypes.ENUM('admin', 'tecnico'), allowNull: false, defaultValue: 'tecnico' },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
      },
      {
        sequelize,
        tableName: 'users',
        underscored: true
      }
    );
    return User;
  }
}
