import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Moneda } from '../shared/utils/dinero';
import type { Cliente } from './Cliente';
import type { Sucursal } from './Sucursal';
import type { User } from './User';
import type { VentaItem } from './VentaItem';
import type { VentaPago } from './VentaPago';
import type { VentaPartePago } from './VentaPartePago';

/**
 * Reservada: apartada sin pago hasta `reservadaHasta`; al pasar la fecha vence
 * sola y los equipos vuelven al stock. Señada: el cliente pagó una parte; no
 * vence sola, a los días se avisa a un admin. Completada: pagó todo y se llevó
 * los equipos. Cancelada (una reserva o seña que no siguió), anulada (una
 * completada que se dio vuelta) y vencida quedan como registro: una venta nunca
 * se borra. `canceladaEn`, `canceladaPorId` y `motivoCancelacion` sirven para
 * las canceladas y las anuladas.
 */
export const ESTADOS_VENTA = [
  'reservada',
  'senada',
  'completada',
  'cancelada',
  'vencida',
  'anulada'
] as const;
export type EstadoVenta = (typeof ESTADOS_VENTA)[number];

export const TIPOS_DESCUENTO = ['porcentaje', 'monto'] as const;
export type TipoDescuento = (typeof TIPOS_DESCUENTO)[number];

export interface VentaAttributes {
  id: number;
  tallerId: number;
  sucursalId: number;
  numero: number;
  clienteId: number;
  estado: EstadoVenta;
  moneda: Moneda;
  cotizacion?: string | null;
  subtotal: string;
  descuentoTipo?: TipoDescuento | null;
  descuentoValor?: string | null;
  descuento: string;
  total: string;
  partePago: string;
  reservadaHasta?: string | null;
  comentarioCliente?: string | null;
  comentarioInterno?: string | null;
  vendedorId?: number | null;
  completadaEn?: Date | null;
  canceladaEn?: Date | null;
  canceladaPorId?: number | null;
  motivoCancelacion?: string | null;
  avisoSenaEn?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VentaCreationAttributes = Optional<
  VentaAttributes,
  | 'id'
  | 'cotizacion'
  | 'descuentoTipo'
  | 'descuentoValor'
  | 'descuento'
  | 'partePago'
  | 'reservadaHasta'
  | 'comentarioCliente'
  | 'comentarioInterno'
  | 'vendedorId'
  | 'completadaEn'
  | 'canceladaEn'
  | 'canceladaPorId'
  | 'motivoCancelacion'
  | 'avisoSenaEn'
  | 'createdAt'
  | 'updatedAt'
>;

export class Venta extends Model<VentaAttributes, VentaCreationAttributes> implements VentaAttributes {
  declare id: number;
  declare tallerId: number;
  declare sucursalId: number;
  /** Correlativo por taller: se muestra como VTA-000042. */
  declare numero: number;
  declare clienteId: number;
  declare estado: EstadoVenta;
  /** Todos los montos de la venta van en esta moneda. */
  declare moneda: Moneda;
  /** Cuánto valía 1 US$ en la moneda de la venta. Vacío si es en dólares. */
  declare cotizacion: string | null;
  // DECIMAL vuelve como string desde Sequelize.
  /** Suma de los precios de los equipos. */
  declare subtotal: string;
  declare descuentoTipo: TipoDescuento | null;
  /** Lo que se cargó: 10 (%) o 50000 (monto). */
  declare descuentoValor: string | null;
  /** El descuento ya calculado, en la moneda de la venta. */
  declare descuento: string;
  /** Lo que vale la venta: subtotal menos descuento. Es el bruto del informe. */
  declare total: string;
  /** Lo que se le tomó en equipos: es una forma de pago, no un descuento. */
  declare partePago: string;
  declare reservadaHasta: string | null;
  /** Se imprime en el comprobante. */
  declare comentarioCliente: string | null;
  /** Solo lo ve el taller. */
  declare comentarioInterno: string | null;
  declare vendedorId: number | null;
  declare completadaEn: Date | null;
  declare canceladaEn: Date | null;
  declare canceladaPorId: number | null;
  declare motivoCancelacion: string | null;
  /** Cuándo se avisó a los admins que la seña lleva demasiados días sin completarse. */
  declare avisoSenaEn: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Asociaciones: solo están cargadas cuando la consulta las incluye.
  declare cliente?: NonAttribute<Cliente>;
  declare sucursal?: NonAttribute<Sucursal>;
  declare vendedor?: NonAttribute<User>;
  declare canceladaPor?: NonAttribute<User>;
  declare items?: NonAttribute<VentaItem[]>;
  declare partesPago?: NonAttribute<VentaPartePago[]>;
  declare pagos?: NonAttribute<VentaPago[]>;

  static initModel(sequelize: Sequelize): typeof Venta {
    Venta.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false, field: 'sucursal_id' },
        numero: { type: DataTypes.INTEGER, allowNull: false },
        clienteId: { type: DataTypes.INTEGER, allowNull: false, field: 'cliente_id' },
        estado: { type: DataTypes.ENUM(...ESTADOS_VENTA), allowNull: false },
        moneda: { type: DataTypes.STRING(3), allowNull: false },
        cotizacion: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
        subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        descuentoTipo: { type: DataTypes.ENUM(...TIPOS_DESCUENTO), allowNull: true, field: 'descuento_tipo' },
        descuentoValor: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'descuento_valor' },
        descuento: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        partePago: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'parte_pago' },
        reservadaHasta: { type: DataTypes.DATEONLY, allowNull: true, field: 'reservada_hasta' },
        comentarioCliente: { type: DataTypes.TEXT, allowNull: true, field: 'comentario_cliente' },
        comentarioInterno: { type: DataTypes.TEXT, allowNull: true, field: 'comentario_interno' },
        vendedorId: { type: DataTypes.INTEGER, allowNull: true, field: 'vendedor_id' },
        completadaEn: { type: DataTypes.DATE, allowNull: true, field: 'completada_en' },
        canceladaEn: { type: DataTypes.DATE, allowNull: true, field: 'cancelada_en' },
        canceladaPorId: { type: DataTypes.INTEGER, allowNull: true, field: 'cancelada_por_id' },
        motivoCancelacion: { type: DataTypes.STRING(255), allowNull: true, field: 'motivo_cancelacion' },
        avisoSenaEn: { type: DataTypes.DATE, allowNull: true, field: 'aviso_sena_en' }
      },
      {
        sequelize,
        tableName: 'ventas',
        underscored: true
      }
    );
    return Venta;
  }
}
