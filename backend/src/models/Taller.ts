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
  pais: string;
  codigoPublico?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TallerCreationAttributes = Optional<
  TallerAttributes,
  'id' | 'activo' | 'pais' | 'codigoPublico' | 'createdAt' | 'updatedAt'
>;

export class Taller extends Model<TallerAttributes, TallerCreationAttributes> implements TallerAttributes {
  declare id: number;
  declare nombre: string;
  declare activo: boolean;
  /** ISO 3166-1 alfa-2. Define la moneda por defecto y el prefijo de WhatsApp. */
  declare pais: string;
  /** Arma el link del portal de clientes. Se completa al pedirlo si falta (ver `codigoPublicoDe`). */
  declare codigoPublico: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof Taller {
    Taller.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        nombre: { type: DataTypes.STRING(150), allowNull: false },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        pais: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'AR' },
        codigoPublico: { type: DataTypes.STRING(12), allowNull: true, field: 'codigo_publico' }
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
