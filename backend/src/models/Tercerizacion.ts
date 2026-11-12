import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Orden } from './Orden';
import type { Taller } from './Taller';
import type { User } from './User';

/**
 * - `enviada`: el equipo salió del taller.
 * - `recibida`: el taller destino (de RepairOS) confirmó que le llegó.
 * - `devuelta`: volvió; la orden salió de "externo".
 * - `cancelada`: no llegó a hacerse (el destino no lo recibió o se arrepintió el origen).
 */
export const ESTADOS_TERCERIZACION = ['enviada', 'recibida', 'devuelta', 'cancelada'] as const;
export type EstadoTercerizacion = (typeof ESTADOS_TERCERIZACION)[number];

/** Mientras está en uno de estos, el equipo está afuera. */
export const TERCERIZACION_ACTIVA: readonly EstadoTercerizacion[] = ['enviada', 'recibida'];

/**
 * Envío de un equipo a reparar afuera: a otro taller o a un técnico.
 *
 * Los datos del destino se guardan acá aunque sea un taller de RepairOS: son los
 * que se usaron al mandarlo, y no cambian si después el otro taller edita los suyos.
 */
export interface TercerizacionAttributes {
  id: number;
  tallerId: number;
  ordenId: number;
  estado: EstadoTercerizacion;
  nombre: string;
  /** Solo dígitos: DNI (7-8) o CUIT (11). */
  dniCuit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  /** Qué se le pide al destino. En RepairOS es la "reparación solicitada" de su orden. */
  trabajo: string;
  tallerDestinoId?: number | null;
  ordenDestinoId?: number | null;
  enviadaPorId?: number | null;
  recibidaEn?: Date | null;
  devueltaEn?: Date | null;
  canceladaEn?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TercerizacionCreationAttributes = Optional<
  TercerizacionAttributes,
  | 'id'
  | 'estado'
  | 'dniCuit'
  | 'direccion'
  | 'telefono'
  | 'email'
  | 'tallerDestinoId'
  | 'ordenDestinoId'
  | 'enviadaPorId'
  | 'recibidaEn'
  | 'devueltaEn'
  | 'canceladaEn'
  | 'createdAt'
  | 'updatedAt'
>;

export class Tercerizacion
  extends Model<TercerizacionAttributes, TercerizacionCreationAttributes>
  implements TercerizacionAttributes
{
  declare id: number;
  declare tallerId: number;
  declare ordenId: number;
  declare estado: EstadoTercerizacion;
  declare nombre: string;
  declare dniCuit: string | null;
  declare direccion: string | null;
  declare telefono: string | null;
  declare email: string | null;
  declare trabajo: string;
  declare tallerDestinoId: number | null;
  declare ordenDestinoId: number | null;
  declare enviadaPorId: number | null;
  declare recibidaEn: Date | null;
  declare devueltaEn: Date | null;
  declare canceladaEn: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare orden?: NonAttribute<Orden>;
  declare ordenDestino?: NonAttribute<Orden>;
  declare taller?: NonAttribute<Taller>;
  declare tallerDestino?: NonAttribute<Taller>;
  declare enviadaPor?: NonAttribute<User>;

  static initModel(sequelize: Sequelize): typeof Tercerizacion {
    Tercerizacion.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
        estado: {
          type: DataTypes.ENUM(...ESTADOS_TERCERIZACION),
          allowNull: false,
          defaultValue: 'enviada'
        },
        nombre: { type: DataTypes.STRING(150), allowNull: false },
        dniCuit: { type: DataTypes.STRING(11), allowNull: true, field: 'dni_cuit' },
        direccion: { type: DataTypes.STRING(255), allowNull: true },
        telefono: { type: DataTypes.STRING(50), allowNull: true },
        email: { type: DataTypes.STRING(150), allowNull: true },
        trabajo: { type: DataTypes.TEXT, allowNull: false },
        tallerDestinoId: { type: DataTypes.INTEGER, allowNull: true, field: 'taller_destino_id' },
        ordenDestinoId: { type: DataTypes.INTEGER, allowNull: true, field: 'orden_destino_id' },
        enviadaPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'enviada_por_id' },
        recibidaEn: { type: DataTypes.DATE, allowNull: true, field: 'recibida_en' },
        devueltaEn: { type: DataTypes.DATE, allowNull: true, field: 'devuelta_en' },
        canceladaEn: { type: DataTypes.DATE, allowNull: true, field: 'cancelada_en' }
      },
      {
        sequelize,
        tableName: 'tercerizaciones',
        underscored: true
      }
    );
    return Tercerizacion;
  }
}
