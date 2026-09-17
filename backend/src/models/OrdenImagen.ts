import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface OrdenImagenAttributes {
  id: number;
  ordenId: number;
  url: string;
  storageKey: string;
  descripcion?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrdenImagenCreationAttributes = Optional<
  OrdenImagenAttributes,
  'id' | 'descripcion' | 'createdAt' | 'updatedAt'
>;

export class OrdenImagen
  extends Model<OrdenImagenAttributes, OrdenImagenCreationAttributes>
  implements OrdenImagenAttributes
{
  public id!: number;
  public ordenId!: number;
  public url!: string;
  public storageKey!: string;
  public descripcion!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof OrdenImagen {
    OrdenImagen.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
        url: { type: DataTypes.STRING(500), allowNull: false },
        storageKey: { type: DataTypes.STRING(500), allowNull: false, field: 'storage_key' },
        descripcion: { type: DataTypes.STRING(255), allowNull: true }
      },
      {
        sequelize,
        tableName: 'orden_imagenes',
        underscored: true
      }
    );
    return OrdenImagen;
  }
}
