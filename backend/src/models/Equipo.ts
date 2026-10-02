import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Cliente } from './Cliente';
import type { TipoEquipoPersonalizado } from './TipoEquipoPersonalizado';

export interface EquipoAttributes {
  id: number;
  tallerId: number;
  clienteId: number;
  tipoEquipoPersonalizadoId: number;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  numeroSerie: string;
  claveDesbloqueoEnc?: string | null;
  cuentaUsuarioEnc?: string | null;
  cuentaPasswordEnc?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EquipoCreationAttributes = Optional<
  EquipoAttributes,
  | 'id'
  | 'marca'
  | 'modelo'
  | 'color'
  | 'claveDesbloqueoEnc'
  | 'cuentaUsuarioEnc'
  | 'cuentaPasswordEnc'
  | 'createdAt'
  | 'updatedAt'
>;

export class Equipo extends Model<EquipoAttributes, EquipoCreationAttributes> implements EquipoAttributes {
  declare id: number;
  declare tallerId: number;
  declare clienteId: number;
  declare tipoEquipoPersonalizadoId: number;
  declare marca: string | null;
  declare modelo: string | null;
  declare color: string | null;
  declare numeroSerie: string;
  declare claveDesbloqueoEnc: string | null;
  declare cuentaUsuarioEnc: string | null;
  declare cuentaPasswordEnc: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare cliente?: NonAttribute<Cliente>;
  declare tipoEquipo?: NonAttribute<TipoEquipoPersonalizado>;

  static initModel(sequelize: Sequelize): typeof Equipo {
    Equipo.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        clienteId: { type: DataTypes.INTEGER, allowNull: false, field: 'cliente_id' },
        tipoEquipoPersonalizadoId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'tipo_equipo_personalizado_id'
        },
        marca: { type: DataTypes.STRING(100), allowNull: true },
        modelo: { type: DataTypes.STRING(100), allowNull: true },
        color: { type: DataTypes.STRING(50), allowNull: true },
        numeroSerie: { type: DataTypes.STRING(150), allowNull: false, field: 'numero_serie' },
        claveDesbloqueoEnc: { type: DataTypes.TEXT, allowNull: true, field: 'clave_desbloqueo_enc' },
        cuentaUsuarioEnc: { type: DataTypes.TEXT, allowNull: true, field: 'cuenta_usuario_enc' },
        cuentaPasswordEnc: { type: DataTypes.TEXT, allowNull: true, field: 'cuenta_password_enc' }
      },
      {
        sequelize,
        tableName: 'equipos',
        underscored: true
      }
    );
    return Equipo;
  }
}
