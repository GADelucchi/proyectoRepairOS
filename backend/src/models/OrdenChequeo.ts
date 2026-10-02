import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { OpcionChequeo } from './TipoEquipoPersonalizado';

/** Opciones por defecto cuando el tipo de equipo no define las suyas. */
export const OPCIONES_CHEQUEO_POR_DEFECTO: OpcionChequeo[] = [
  { etiqueta: 'Sí' },
  { etiqueta: 'No' },
  { etiqueta: 'Sin revisar' }
];

export interface OrdenChequeoAttributes {
  id: number;
  ordenId: number;
  item: string;
  /** Etiqueta elegida entre `opciones`. Null mientras no se respondió. */
  resultado?: string | null;
  /**
   * Opciones vigentes al recibir el equipo. Se copian del tipo de equipo y no
   * cambian después: una orden vieja tiene que seguir mostrando con qué
   * alternativas se la respondió, aunque el checklist del tipo se haya editado.
   */
  opciones: OpcionChequeo[];
  orden: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrdenChequeoCreationAttributes = Optional<
  OrdenChequeoAttributes,
  'id' | 'resultado' | 'opciones' | 'orden' | 'createdAt' | 'updatedAt'
>;

export class OrdenChequeo
  extends Model<OrdenChequeoAttributes, OrdenChequeoCreationAttributes>
  implements OrdenChequeoAttributes
{
  declare id: number;
  declare ordenId: number;
  declare item: string;
  declare resultado: string | null;
  declare opciones: OpcionChequeo[];
  declare orden: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof OrdenChequeo {
    OrdenChequeo.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
        item: { type: DataTypes.STRING(150), allowNull: false },
        resultado: { type: DataTypes.STRING(80), allowNull: true, defaultValue: null },
        opciones: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: OPCIONES_CHEQUEO_POR_DEFECTO
        },
        orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
      },
      {
        sequelize,
        tableName: 'orden_chequeos',
        underscored: true
      }
    );
    return OrdenChequeo;
  }
}
