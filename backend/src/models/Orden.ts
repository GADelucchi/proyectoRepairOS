import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

export type EstadoOrden =
  | 'recibido'
  | 'en_diagnostico'
  | 'presupuestado'
  | 'aprobado'
  | 'rechazado'
  | 'en_reparacion'
  | 'listo_para_retirar'
  | 'entregado'
  | 'cancelado';

export const ESTADOS_ORDEN: EstadoOrden[] = [
  'recibido',
  'en_diagnostico',
  'presupuestado',
  'aprobado',
  'rechazado',
  'en_reparacion',
  'listo_para_retirar',
  'entregado',
  'cancelado'
];

export interface OrdenAttributes {
  id: number;
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
  | 'montoTotal'
  | 'montoAbonado'
  | 'creditoAplicado'
  | 'fechaEntrega'
  | 'createdAt'
  | 'updatedAt'
>;

export class Orden extends Model<OrdenAttributes, OrdenCreationAttributes> implements OrdenAttributes {
  public id!: number;
  public numeroOrden!: string;
  public clienteId!: number;
  public equipoId!: number;
  public sucursalId!: number;
  public tecnicoId!: number;
  public estado!: EstadoOrden;
  public fechaIngreso!: Date;
  public fechaPactada!: string | null;
  public detallesEsteticos!: string | null;
  public reparacionSolicitada!: string | null;
  public notasInternas!: string | null;
  public presupuestoMonto!: number | null;
  public presupuestoAprobado!: boolean | null;
  public firmaClienteUrl!: string | null;
  // Lo que se cobró al entregar. DECIMAL vuelve como string desde Sequelize.
  public montoTotal!: string | null;
  public montoAbonado!: string | null;
  /** Saldo a favor del cliente que se usó para cubrir esta orden. */
  public creditoAplicado!: string | null;
  public fechaEntrega!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Orden {
    Orden.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        numeroOrden: { type: DataTypes.STRING(30), allowNull: false, unique: true, field: 'numero_orden' },
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
        underscored: true
      }
    );
    return Orden;
  }
}
