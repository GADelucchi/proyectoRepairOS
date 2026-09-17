import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type EstadoSuscripcion = 'prueba' | 'activa' | 'vencida' | 'cancelada';

/**
 * Suscripción del taller: una por taller.
 *
 * Al registrarse arranca en `prueba` con un mes de gracia, sin plan elegido.
 * `graciaHasta` es la fecha hasta la que puede operar sin haber pagado.
 */
export interface SuscripcionAttributes {
  id: number;
  tallerId: number;
  planId?: number | null;
  estado: EstadoSuscripcion;
  graciaHasta: string;
  periodoFin?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SuscripcionCreationAttributes = Optional<
  SuscripcionAttributes,
  'id' | 'planId' | 'estado' | 'periodoFin' | 'createdAt' | 'updatedAt'
>;

export class Suscripcion
  extends Model<SuscripcionAttributes, SuscripcionCreationAttributes>
  implements SuscripcionAttributes
{
  public id!: number;
  public tallerId!: number;
  public planId!: number | null;
  public estado!: EstadoSuscripcion;
  public graciaHasta!: string;
  public periodoFin!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Suscripcion {
    Suscripcion.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'taller_id' },
        planId: { type: DataTypes.INTEGER, allowNull: true, field: 'plan_id' },
        estado: {
          type: DataTypes.ENUM('prueba', 'activa', 'vencida', 'cancelada'),
          allowNull: false,
          defaultValue: 'prueba'
        },
        graciaHasta: { type: DataTypes.DATEONLY, allowNull: false, field: 'gracia_hasta' },
        periodoFin: { type: DataTypes.DATEONLY, allowNull: true, field: 'periodo_fin' }
      },
      {
        sequelize,
        tableName: 'suscripciones',
        underscored: true
      }
    );
    return Suscripcion;
  }
}
