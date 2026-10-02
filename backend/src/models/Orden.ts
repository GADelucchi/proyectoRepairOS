import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Cliente } from './Cliente';
import type { Equipo } from './Equipo';
import type { Sucursal } from './Sucursal';
import type { User } from './User';
import type { OrdenChequeo } from './OrdenChequeo';
import type { OrdenImagen } from './OrdenImagen';
import type { OrdenHistorialEstado } from './OrdenHistorialEstado';

export const ESTADOS_ORDEN = [
  'recibido',
  'en_diagnostico',
  'presupuestado',
  'aprobado',
  'rechazado',
  'en_reparacion',
  'listo_para_retirar',
  'entregado',
  'cancelado'
] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export interface OrdenAttributes {
  id: number;
  tallerId: number;
  numeroOrden: string;
  clienteId: number;
  equipoId: number;
  sucursalId: number;
  tecnicoId: number;
  estado: EstadoOrden;
  fechaIngreso: Date;
  fechaPactada?: string | null;
  detallesEsteticos?: string | null;
  reparacionSolicitada?: string | null;
  notasInternas?: string | null;
  presupuestoMonto?: number | null;
  presupuestoAprobado?: boolean | null;
  firmaClienteUrl?: string | null;
  firmaClienteEnc?: string | null;
  firmaClienteAt?: Date | null;
  montoTotal?: string | null;
  montoAbonado?: string | null;
  creditoAplicado?: string | null;
  fechaEntrega?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrdenCreationAttributes = Optional<
  OrdenAttributes,
  | 'id'
  | 'estado'
  | 'fechaIngreso'
  | 'fechaPactada'
  | 'detallesEsteticos'
  | 'reparacionSolicitada'
  | 'notasInternas'
  | 'presupuestoMonto'
  | 'presupuestoAprobado'
  | 'firmaClienteUrl'
  | 'firmaClienteEnc'
  | 'firmaClienteAt'
  | 'montoTotal'
  | 'montoAbonado'
  | 'creditoAplicado'
  | 'fechaEntrega'
  | 'createdAt'
  | 'updatedAt'
>;

export class Orden extends Model<OrdenAttributes, OrdenCreationAttributes> implements OrdenAttributes {
  declare id: number;
  declare tallerId: number;
  declare numeroOrden: string;
  declare clienteId: number;
  declare equipoId: number;
  declare sucursalId: number;
  declare tecnicoId: number;
  declare estado: EstadoOrden;
  declare fechaIngreso: Date;
  declare fechaPactada: string | null;
  declare detallesEsteticos: string | null;
  declare reparacionSolicitada: string | null;
  declare notasInternas: string | null;
  declare presupuestoMonto: number | null;
  declare presupuestoAprobado: boolean | null;
  /** URL pública del PNG. Solo para firmas anteriores al cifrado. */
  declare firmaClienteUrl: string | null;
  /** PNG de la firma cifrado con AES-256-GCM. Excluido del scope por defecto. */
  declare firmaClienteEnc: string | null;
  /** Cuándo firmó el cliente. Es la constancia del consentimiento. */
  declare firmaClienteAt: Date | null;
  // Lo que se cobró al entregar. DECIMAL vuelve como string desde Sequelize.
  declare montoTotal: string | null;
  declare montoAbonado: string | null;
  /** Saldo a favor del cliente que se usó para cubrir esta orden. */
  declare creditoAplicado: string | null;
  declare fechaEntrega: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Asociaciones: solo están cargadas cuando la consulta las incluye.
  declare cliente?: NonAttribute<Cliente>;
  declare equipo?: NonAttribute<Equipo>;
  declare sucursal?: NonAttribute<Sucursal>;
  declare tecnico?: NonAttribute<User>;
  declare chequeos?: NonAttribute<OrdenChequeo[]>;
  declare imagenes?: NonAttribute<OrdenImagen[]>;
  declare historialEstados?: NonAttribute<OrdenHistorialEstado[]>;

  static initModel(sequelize: Sequelize): typeof Orden {
    Orden.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        // Único por taller (índice `uq_ordenes_taller_numero`), no global.
        numeroOrden: { type: DataTypes.STRING(30), allowNull: false, field: 'numero_orden' },
        clienteId: { type: DataTypes.INTEGER, allowNull: false, field: 'cliente_id' },
        equipoId: { type: DataTypes.INTEGER, allowNull: false, field: 'equipo_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false, field: 'sucursal_id' },
        tecnicoId: { type: DataTypes.INTEGER, allowNull: false, field: 'tecnico_id' },
        estado: {
          type: DataTypes.ENUM(...ESTADOS_ORDEN),
          allowNull: false,
          defaultValue: 'recibido'
        },
        fechaIngreso: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
          field: 'fecha_ingreso'
        },
        fechaPactada: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_pactada' },
        detallesEsteticos: { type: DataTypes.TEXT, allowNull: true, field: 'detalles_esteticos' },
        reparacionSolicitada: { type: DataTypes.TEXT, allowNull: true, field: 'reparacion_solicitada' },
        notasInternas: { type: DataTypes.TEXT, allowNull: true, field: 'notas_internas' },
        presupuestoMonto: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'presupuesto_monto' },
        presupuestoAprobado: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: null,
          field: 'presupuesto_aprobado'
        },
        firmaClienteUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'firma_cliente_url' },
        firmaClienteEnc: { type: DataTypes.TEXT('medium'), allowNull: true, field: 'firma_cliente_enc' },
        firmaClienteAt: { type: DataTypes.DATE, allowNull: true, field: 'firma_cliente_at' },
        montoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'monto_total' },
        montoAbonado: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'monto_abonado' },
        creditoAplicado: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          field: 'credito_aplicado'
        },
        fechaEntrega: { type: DataTypes.DATE, allowNull: true, field: 'fecha_entrega' }
      },
      {
        sequelize,
        tableName: 'ordenes',
        underscored: true,
        // La firma cifrada no sale en ninguna respuesta por omisión: son decenas
        // de KB por orden y no hay pantalla que la use en crudo. Quien la
        // necesita (el endpoint de firma y el remito) pide el scope `conFirma`.
        defaultScope: {
          attributes: { exclude: ['firmaClienteEnc'] }
        },
        scopes: {
          conFirma: {}
        }
      }
    );
    return Orden;
  }
}
