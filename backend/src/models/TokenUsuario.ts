import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export const TIPOS_TOKEN = ['restablecer_password', 'verificar_email'] as const;
export type TipoToken = (typeof TIPOS_TOKEN)[number];

/**
 * Token de un solo uso que viaja por email (recuperar la contraseña, verificar
 * el email). Se guarda solo su hash SHA-256.
 */
export interface TokenUsuarioAttributes {
  id: number;
  usuarioId: number;
  tipo: TipoToken;
  tokenHash: string;
  expiraEn: Date;
  usadoEn?: Date | null;
  createdAt?: Date;
}

export type TokenUsuarioCreationAttributes = Optional<TokenUsuarioAttributes, 'id' | 'usadoEn' | 'createdAt'>;

export class TokenUsuario
  extends Model<TokenUsuarioAttributes, TokenUsuarioCreationAttributes>
  implements TokenUsuarioAttributes
{
  declare id: number;
  declare usuarioId: number;
  declare tipo: TipoToken;
  declare tokenHash: string;
  declare expiraEn: Date;
  declare usadoEn: Date | null;
  declare readonly createdAt: Date;

  static initModel(sequelize: Sequelize): typeof TokenUsuario {
    TokenUsuario.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        tipo: { type: DataTypes.STRING(30), allowNull: false },
        tokenHash: { type: DataTypes.CHAR(64), allowNull: false, field: 'token_hash' },
        expiraEn: { type: DataTypes.DATE, allowNull: false, field: 'expira_en' },
        usadoEn: { type: DataTypes.DATE, allowNull: true, field: 'usado_en' }
      },
      { sequelize, tableName: 'tokens_usuario', underscored: true, updatedAt: false }
    );
    return TokenUsuario;
  }
}
