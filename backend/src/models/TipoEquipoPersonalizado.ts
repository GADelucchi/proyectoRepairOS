import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface OpcionChequeo {
  id?: number;
  etiqueta: string;
}

export interface TipoEquipoPersonalizadoAttributes {
  id: number;
  nombre: string;
  /** Quién lo creó. Es autoría, no propiedad: el tipo pertenece a la sucursal. */
  usuarioId: number | null;
  sucursalId: number;
  activo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TipoEquipoPersonalizadoCreationAttributes = Optional<
  TipoEquipoPersonalizadoAttributes,
  'id' | 'usuarioId' | 'activo' | 'createdAt' | 'updatedAt'
>;

export class TipoEquipoPersonalizado
  extends Model<TipoEquipoPersonalizadoAttributes, TipoEquipoPersonalizadoCreationAttributes>
  implements TipoEquipoPersonalizadoAttributes
{
  declare id: number;
  declare nombre: string;
  declare usuarioId: number | null;
  declare sucursalId: number;
  declare activo: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof TipoEquipoPersonalizado {
    TipoEquipoPersonalizado.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        nombre: { type: DataTypes.STRING(255), allowNull: false },
        usuarioId: { type: DataTypes.INTEGER, allowNull: true, field: 'usuario_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false, field: 'sucursal_id' },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
      },
      {
        sequelize,
        tableName: 'tipo_equipo_personalizados',
        underscored: true,
        timestamps: true
      }
    );
    return TipoEquipoPersonalizado;
  }
}
