import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { MedioPago } from './CuentaMovimiento';

export type TipoSolicitud = 'fiado' | 'ajuste';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

/** Lo que hace falta para ejecutar la entrega cuando se aprueba el fiado. */
export interface DatosFiado {
  montoTotal: number;
  montoAbonado: number;
  medioPago?: MedioPago | null;
}

/** Hacia dónde mueve el saldo un ajuste aprobado. */
export interface DatosAjuste {
  direccion: 'debito' | 'credito';
}

/**
 * Pedido de autorización a un supervisor.
 *
 * Fiar sin cuenta habilitada y ajustar un saldo son decisiones que el mostrador
 * no puede tomar solo. En vez de frenarlas y dejar al cliente esperando, se
 * piden: queda el pedido con su motivo, y un admin lo aprueba o lo rechaza.
 *
 * Se guarda quién pidió, quién resolvió y por qué, porque el registro de quién
 * autorizó fiar es justamente el que hace falta cuando esa deuda no se cobra.
 */
export interface SolicitudAttributes {
  id: number;
  tallerId: number;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  clienteId: number;
  ordenId?: number | null;
  sucursalId?: number | null;
  solicitanteId: number;
  resueltoPorId?: number | null;
  monto: string;
  datos?: DatosFiado | DatosAjuste | null;
  motivo: string;
  respuesta?: string | null;
  resueltoEn?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SolicitudCreationAttributes = Optional<
  SolicitudAttributes,
  | 'id'
  | 'estado'
  | 'ordenId'
  | 'sucursalId'
  | 'resueltoPorId'
  | 'datos'
  | 'respuesta'
  | 'resueltoEn'
  | 'createdAt'
  | 'updatedAt'
>;

export class Solicitud
  extends Model<SolicitudAttributes, SolicitudCreationAttributes>
  implements SolicitudAttributes
{
  public id!: number;
  public tallerId!: number;
  public tipo!: TipoSolicitud;
  public estado!: EstadoSolicitud;
  public clienteId!: number;
  public ordenId!: number | null;
  public sucursalId!: number | null;
  public solicitanteId!: number;
  public resueltoPorId!: number | null;
  public monto!: string;
  public datos!: DatosFiado | DatosAjuste | null;
  public motivo!: string;
  public respuesta!: string | null;
  public resueltoEn!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Solicitud {
    Solicitud.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        tipo: { type: DataTypes.ENUM('fiado', 'ajuste'), allowNull: false },
        estado: {
          type: DataTypes.ENUM('pendiente', 'aprobada', 'rechazada', 'cancelada'),
          allowNull: false,
          defaultValue: 'pendiente'
        },
        clienteId: { type: DataTypes.INTEGER, allowNull: false, field: 'cliente_id' },
        ordenId: { type: DataTypes.INTEGER, allowNull: true, field: 'orden_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: true, field: 'sucursal_id' },
        solicitanteId: { type: DataTypes.INTEGER, allowNull: false, field: 'solicitante_id' },
        resueltoPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'resuelto_por_id' },
        monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        datos: { type: DataTypes.JSON, allowNull: true },
        motivo: { type: DataTypes.STRING(500), allowNull: false },
        respuesta: { type: DataTypes.STRING(500), allowNull: true },
        resueltoEn: { type: DataTypes.DATE, allowNull: true, field: 'resuelto_en' }
      },
      {
        sequelize,
        tableName: 'solicitudes',
        underscored: true
      }
    );
    return Solicitud;
  }
}
