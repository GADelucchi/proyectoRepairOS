import { DataTypes, Model, NonAttribute, Optional, Sequelize } from 'sequelize';
import type { Moneda } from '../shared/utils/dinero';
import type { MedioPago } from './CuentaMovimiento';
import type { User } from './User';

/**
 * Plata de una venta. `sena`: lo que se paga antes de llevarse el equipo.
 * `pago`: lo que completa la venta. `devolucion`: la seña que se le devolvió al
 * cancelar. El monto siempre es positivo; la caja resta las devoluciones.
 *
 * El monto va en la moneda en la que entró la plata, que puede no ser la de la
 * venta: `equivalente` es lo que cubre de la venta, en su moneda.
 */
export const TIPOS_PAGO_VENTA = ['sena', 'pago', 'devolucion'] as const;
export type TipoPagoVenta = (typeof TIPOS_PAGO_VENTA)[number];

export interface VentaPagoAttributes {
  id: number;
  tallerId: number;
  sucursalId: number;
  ventaId: number;
  tipo: TipoPagoVenta;
  monto: string;
  moneda: Moneda;
  /** 1 US$ en la moneda que no es dólar. Null si el pago es en la moneda de la venta. */
  cotizacion?: string | null;
  /** El pago en la moneda de la venta: lo que baja el saldo. */
  equivalente: string;
  medioPago?: MedioPago | null;
  usuarioId: number;
  nota?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VentaPagoCreationAttributes = Optional<
  VentaPagoAttributes,
  'id' | 'cotizacion' | 'medioPago' | 'nota' | 'createdAt' | 'updatedAt'
>;

export class VentaPago
  extends Model<VentaPagoAttributes, VentaPagoCreationAttributes>
  implements VentaPagoAttributes
{
  declare id: number;
  declare tallerId: number;
  /** Dónde entró la plata: la sucursal de quien cobró, no la de la venta. */
  declare sucursalId: number;
  declare ventaId: number;
  declare tipo: TipoPagoVenta;
  declare monto: string;
  declare moneda: Moneda;
  declare cotizacion: string | null;
  declare equivalente: string;
  declare medioPago: MedioPago | null;
  declare usuarioId: number;
  declare nota: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare usuario?: NonAttribute<User>;

  static initModel(sequelize: Sequelize): typeof VentaPago {
    VentaPago.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: false, field: 'sucursal_id' },
        ventaId: { type: DataTypes.INTEGER, allowNull: false, field: 'venta_id' },
        tipo: { type: DataTypes.ENUM(...TIPOS_PAGO_VENTA), allowNull: false },
        monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        moneda: { type: DataTypes.STRING(3), allowNull: false },
        cotizacion: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
        equivalente: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        medioPago: { type: DataTypes.STRING(20), allowNull: true, field: 'medio_pago' },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        nota: { type: DataTypes.STRING(255), allowNull: true }
      },
      {
        sequelize,
        tableName: 'venta_pagos',
        underscored: true
      }
    );
    return VentaPago;
  }
}
