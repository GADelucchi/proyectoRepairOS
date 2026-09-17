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
  esGremio?: boolean | null;
  nombreGremio?: string | null;
  cuentaCorrienteHabilitada: boolean;
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
  | 'esGremio'
  | 'nombreGremio'
  | 'cuentaCorrienteHabilitada'
  | 'createdAt'
  | 'updatedAt'
>;

export class Cliente
  extends Model<ClienteAttributes, ClienteCreationAttributes>
  implements ClienteAttributes
{
  public id!: number;
  public tallerId!: number;
  public nombre!: string;
  public apellido!: string;
  public dniCuit!: string | null;
  public telefono!: string | null;
  public email!: string | null;
  public fechaNacimiento!: string | null;
  public direccion!: string | null;
  public esGremio!: boolean | null;
  public nombreGremio!: string | null;
  public cuentaCorrienteHabilitada!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

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
        esGremio: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false, field: 'es_gremio' },
        nombreGremio: { type: DataTypes.STRING(255), allowNull: true, field: 'nombre_gremio' },
        cuentaCorrienteHabilitada: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'cuenta_corriente_habilitada'
        }
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
