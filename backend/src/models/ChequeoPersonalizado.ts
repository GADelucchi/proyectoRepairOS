import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { OpcionChequeo } from './TipoEquipoPersonalizado';

export interface ChequeoPersonalizadoAttributes {
  id?: number;
  tipoEquipoPersonalizadoId: number;
  texto: string;
  opciones: OpcionChequeo[];
  orden: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChequeoPersonalizadoCreationAttributes = Optional<
  ChequeoPersonalizadoAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'orden'
>;

export class ChequeoPersonalizado
  extends Model<ChequeoPersonalizadoAttributes, ChequeoPersonalizadoCreationAttributes>
  implements ChequeoPersonalizadoAttributes
{
  public id!: number;
  public tipoEquipoPersonalizadoId!: number;
  public texto!: string;
  public opciones!: OpcionChequeo[];
  public orden!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof ChequeoPersonalizado {
    ChequeoPersonalizado.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tipoEquipoPersonalizadoId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'tipo_equipo_personalizado_id'
        },
        texto: { type: DataTypes.TEXT, allowNull: false },
        opciones: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [{ etiqueta: 'Sí' }, { etiqueta: 'No' }, { etiqueta: 'Sin revisar' }]
        },
        orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
      },
      {
        sequelize,
        tableName: 'chequeo_personalizados',
        underscored: true,
        timestamps: true
      }
    );
    return ChequeoPersonalizado;
  }
}
