import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface AccesoSensibleAttributes {
  id: number;
  usuarioId: number;
  equipoId: number;
  sucursalId?: number | null;
  ip?: string | null;
  createdAt?: Date;
}

export type AccesoSensibleCreationAttributes = Optional<
  AccesoSensibleAttributes,
  'id' | 'sucursalId' | 'ip' | 'createdAt'
>;

/** Registro de cada vez que alguien descifra las credenciales de un equipo. */
export class AccesoSensible
  extends Model<AccesoSensibleAttributes, AccesoSensibleCreationAttributes>
  implements AccesoSensibleAttributes
{
  public id!: number;
  public usuarioId!: number;
  public equipoId!: number;
  public sucursalId!: number | null;
  public ip!: string | null;
  public readonly createdAt!: Date;

  static initModel(sequelize: Sequelize): typeof AccesoSensible {
    AccesoSensible.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        equipoId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: true, field: 'sucursal_id' },
        ip: { type: DataTypes.STRING(45), allowNull: true }
      },
      {
        sequelize,
        tableName: 'accesos_sensibles',
        underscored: true,
        updatedAt: false
      }
    );
    return AccesoSensible;
  }
}
