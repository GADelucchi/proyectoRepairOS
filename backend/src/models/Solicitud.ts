import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Cliente } from './Cliente';
import type { Orden } from './Orden';
import { MedioPago } from './CuentaMovimiento';

export const TIPOS_SOLICITUD = ['fiado', 'ajuste'] as const;
export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number];

export const ESTADOS_SOLICITUD = ['pendiente', 'aprobada', 'rechazada', 'cancelada'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

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
  declare id: number;
  declare tallerId: number;
  declare tipo: TipoSolicitud;
  declare estado: EstadoSolicitud;
  declare clienteId: number;
  declare ordenId: number | null;
  declare sucursalId: number | null;
  declare solicitanteId: number;
  declare resueltoPorId: number | null;
  declare monto: string;
  declare datos: DatosFiado | DatosAjuste | null;
  declare motivo: string;
  declare respuesta: string | null;
  declare resueltoEn: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare cliente?: NonAttribute<Cliente>;
  declare orden?: NonAttribute<Orden | null>;

  static initModel(sequelize: Sequelize): typeof Solicitud {
    Solicitud.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        tipo: { type: DataTypes.ENUM(...TIPOS_SOLICITUD), allowNull: false },
        estado: {
          type: DataTypes.ENUM(...ESTADOS_SOLICITUD),
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
