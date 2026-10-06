import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export interface ClienteAttributes {
  id: number;
  tallerId: number;
  nombre: string;
  apellido: string;
  dniCuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  fechaNacimiento?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  esGremio?: boolean | null;
  nombreGremio?: string | null;
  cuentaCorrienteHabilitada: boolean;
  anonimizadoEn?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ClienteCreationAttributes = Optional<
  ClienteAttributes,
  | 'id'
  | 'dniCuit'
  | 'telefono'
  | 'email'
  | 'fechaNacimiento'
  | 'direccion'
  | 'ciudad'
  | 'esGremio'
  | 'nombreGremio'
  | 'cuentaCorrienteHabilitada'
  | 'anonimizadoEn'
  | 'createdAt'
  | 'updatedAt'
>;

export class Cliente
  extends Model<ClienteAttributes, ClienteCreationAttributes>
  implements ClienteAttributes
{
  declare id: number;
  declare tallerId: number;
  declare nombre: string;
  declare apellido: string;
  declare dniCuit: string | null;
  declare telefono: string | null;
  declare email: string | null;
  declare fechaNacimiento: string | null;
  declare direccion: string | null;
  declare ciudad: string | null;
  declare esGremio: boolean | null;
  declare nombreGremio: string | null;
  declare cuentaCorrienteHabilitada: boolean;
  /** Fecha en que se ejerció el derecho de supresión. Null si el cliente está intacto. */
  declare anonimizadoEn: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof Cliente {
    Cliente.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        nombre: { type: DataTypes.STRING(100), allowNull: false },
        apellido: { type: DataTypes.STRING(100), allowNull: false },
        dniCuit: { type: DataTypes.STRING(20), allowNull: true, field: 'dni_cuit' },
        telefono: { type: DataTypes.STRING(50), allowNull: true },
        email: { type: DataTypes.STRING(150), allowNull: true },
        fechaNacimiento: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_nacimiento' },
        direccion: { type: DataTypes.STRING(255), allowNull: true },
        ciudad: { type: DataTypes.STRING(100), allowNull: true },
        esGremio: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false, field: 'es_gremio' },
        nombreGremio: { type: DataTypes.STRING(255), allowNull: true, field: 'nombre_gremio' },
        cuentaCorrienteHabilitada: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'cuenta_corriente_habilitada'
        },
        anonimizadoEn: { type: DataTypes.DATE, allowNull: true, field: 'anonimizado_en' }
      },
      {
        sequelize,
        tableName: 'clientes',
        underscored: true
      }
    );
    return Cliente;
  }
}
