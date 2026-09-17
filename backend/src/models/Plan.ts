import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

/**
 * Plan de suscripción. Los valores salen del sitio público y viven en la base
 * para poder ajustarlos sin publicar una versión nueva del backend.
 *
 * `precioMensual`, `maxSucursales` y `maxUsuarios` en null significan
 * "a convenir" y "sin tope" respectivamente (el plan a medida).
 */
export interface PlanAttributes {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioMensual?: number | null;
  maxSucursales?: number | null;
  maxUsuarios?: number | null;
  activo: boolean;
  orden: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PlanCreationAttributes = Optional<
  PlanAttributes,
  | 'id'
  | 'descripcion'
  | 'precioMensual'
  | 'maxSucursales'
  | 'maxUsuarios'
  | 'activo'
  | 'orden'
  | 'createdAt'
  | 'updatedAt'
>;

export class Plan extends Model<PlanAttributes, PlanCreationAttributes> implements PlanAttributes {
  public id!: number;
  public codigo!: string;
  public nombre!: string;
  public descripcion!: string | null;
  public precioMensual!: number | null;
  public maxSucursales!: number | null;
  public maxUsuarios!: number | null;
  public activo!: boolean;
  public orden!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Plan {
    Plan.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        codigo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
        nombre: { type: DataTypes.STRING(80), allowNull: false },
        descripcion: { type: DataTypes.STRING(255), allowNull: true },
        precioMensual: { type: DataTypes.INTEGER, allowNull: true, field: 'precio_mensual' },
        maxSucursales: { type: DataTypes.INTEGER, allowNull: true, field: 'max_sucursales' },
        maxUsuarios: { type: DataTypes.INTEGER, allowNull: true, field: 'max_usuarios' },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
      },
      {
        sequelize,
        tableName: 'planes',
        underscored: true
      }
    );
    return Plan;
  }
}
