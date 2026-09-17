import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface ContadorAttributes {
  clave: string;
  valor: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ContadorCreationAttributes = Optional<ContadorAttributes, 'valor' | 'createdAt' | 'updatedAt'>;

/** Secuencias del sistema (por ahora, el número de orden). */
export class Contador
  extends Model<ContadorAttributes, ContadorCreationAttributes>
  implements ContadorAttributes
{
  public clave!: string;
  public valor!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Contador {
    Contador.init(
      {
        clave: { type: DataTypes.STRING(50), primaryKey: true },
        valor: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 }
      },
      {
        sequelize,
        tableName: 'contadores',
        underscored: true
      }
    );
    return Contador;
  }
}
