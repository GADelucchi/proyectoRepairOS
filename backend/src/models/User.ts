import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Taller } from './Taller';
import type { Sucursal } from './Sucursal';

export const ROLES_USUARIO = ['admin', 'tecnico'] as const;
export type RolUsuario = (typeof ROLES_USUARIO)[number];

export interface UserAttributes {
  id: number;
  tallerId: number;
  nombre: string;
  apellido: string;
  email: string;
  passwordHash: string;
  rol: RolUsuario;
  activo: boolean;
  ultimoAccesoAt?: Date | null;
  emailVerificadoEn?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  'id' | 'activo' | 'ultimoAccesoAt' | 'emailVerificadoEn' | 'createdAt' | 'updatedAt'
>;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare tallerId: number;
  declare nombre: string;
  declare apellido: string;
  declare email: string;
  declare passwordHash: string;
  declare rol: RolUsuario;
  declare activo: boolean;
  /** Último uso de la app (login o request), con una precisión de minutos. */
  declare ultimoAccesoAt: Date | null;
  /** Null mientras no confirmó su email (solo importa con `EXIGIR_EMAIL_VERIFICADO`). */
  declare emailVerificadoEn: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare taller?: NonAttribute<Taller>;
  declare sucursales?: NonAttribute<Sucursal[]>;

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        nombre: { type: DataTypes.STRING(100), allowNull: false },
        apellido: { type: DataTypes.STRING(100), allowNull: false },
        email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
        passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
        rol: { type: DataTypes.ENUM(...ROLES_USUARIO), allowNull: false, defaultValue: 'tecnico' },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        ultimoAccesoAt: { type: DataTypes.DATE, allowNull: true, field: 'ultimo_acceso_at' },
        emailVerificadoEn: { type: DataTypes.DATE, allowNull: true, field: 'email_verificado_en' }
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
