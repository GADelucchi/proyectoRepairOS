import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { MONEDA_POR_DEFECTO, Moneda } from '../shared/utils/dinero';

/**
 * Tipos de asiento. El monto siempre es positivo: la dirección la da el tipo,
 * así no hay dos formas de anotar lo mismo.
 *
 * - `cargo`: deuda nueva (lo facturado al entregar un equipo).
 * - `pago`: plata que entró y descuenta deuda.
 * - `ajuste_debito` / `ajuste_credito`: corrección del saldo autorizada por un
 *   admin. No es plata que se movió, y por eso los informes de caja no la
 *   cuentan como cobro.
 */
export const TIPOS_MOVIMIENTO = ['cargo', 'pago', 'ajuste_debito', 'ajuste_credito'] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/** Medios con los que puede entrar la plata. `otro` cubre lo que no encaje. */
export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'otro'] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

/**
 * Un asiento de la cuenta corriente del cliente.
 *
 * El saldo sale de sumar estos movimientos, no de una columna acumulada: así el
 * número siempre se puede reconstruir y justificar movimiento por movimiento.
 */
export interface CuentaMovimientoAttributes {
  id: number;
  tallerId: number;
  clienteId: number;
  ordenId?: number | null;
  sucursalId?: number | null;
  usuarioId: number;
  tipo: TipoMovimiento;
  monto: string;
  moneda: Moneda;
  medioPago?: MedioPago | null;
  nota?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CuentaMovimientoCreationAttributes = Optional<
  CuentaMovimientoAttributes,
  'id' | 'ordenId' | 'sucursalId' | 'moneda' | 'medioPago' | 'nota' | 'createdAt' | 'updatedAt'
>;

export class CuentaMovimiento
  extends Model<CuentaMovimientoAttributes, CuentaMovimientoCreationAttributes>
  implements CuentaMovimientoAttributes
{
  declare id: number;
  declare tallerId: number;
  declare clienteId: number;
  declare ordenId: number | null;
  declare sucursalId: number | null;
  declare usuarioId: number;
  declare tipo: TipoMovimiento;
  // Sequelize devuelve DECIMAL como string para no perder precisión en el camino.
  declare monto: string;
  /** El saldo se calcula por moneda: nunca se suman asientos de monedas distintas. */
  declare moneda: Moneda;
  declare medioPago: MedioPago | null;
  declare nota: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof CuentaMovimiento {
    CuentaMovimiento.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        tallerId: { type: DataTypes.INTEGER, allowNull: false, field: 'taller_id' },
        clienteId: { type: DataTypes.INTEGER, allowNull: false, field: 'cliente_id' },
        ordenId: { type: DataTypes.INTEGER, allowNull: true, field: 'orden_id' },
        sucursalId: { type: DataTypes.INTEGER, allowNull: true, field: 'sucursal_id' },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        tipo: {
          type: DataTypes.ENUM(...TIPOS_MOVIMIENTO),
          allowNull: false
        },
        monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: MONEDA_POR_DEFECTO },
        medioPago: { type: DataTypes.STRING(30), allowNull: true, field: 'medio_pago' },
        nota: { type: DataTypes.STRING(255), allowNull: true }
      },
      {
        sequelize,
        tableName: 'cuenta_movimientos',
        underscored: true
      }
    );
    return CuentaMovimiento;
  }
}
