import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { User } from './User';

export interface OrdenHistorialEstadoAttributes {
  id: number;
  ordenId: number;
  estadoAnterior?: string | null;
  estadoNuevo: string;
  usuarioId: number;
  comentario?: string | null;
  createdAt?: Date;
}

export type OrdenHistorialEstadoCreationAttributes = Optional<
  OrdenHistorialEstadoAttributes,
  'id' | 'estadoAnterior' | 'comentario' | 'createdAt'
>;

export class OrdenHistorialEstado
  extends Model<OrdenHistorialEstadoAttributes, OrdenHistorialEstadoCreationAttributes>
  implements OrdenHistorialEstadoAttributes
{
  declare id: number;
  declare ordenId: number;
  declare estadoAnterior: string | null;
  declare estadoNuevo: string;
  declare usuarioId: number;
  declare comentario: string | null;
  declare readonly createdAt: Date;

  declare usuario?: NonAttribute<User>;

  static initModel(sequelize: Sequelize): typeof OrdenHistorialEstado {
    OrdenHistorialEstado.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
        estadoAnterior: { type: DataTypes.STRING(30), allowNull: true, field: 'estado_anterior' },
        estadoNuevo: { type: DataTypes.STRING(30), allowNull: false, field: 'estado_nuevo' },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        comentario: { type: DataTypes.STRING(255), allowNull: true }
      },
      {
        sequelize,
        tableName: 'orden_historial_estados',
        underscored: true,
        updatedAt: false
      }
    );
    return OrdenHistorialEstado;
  }
}
