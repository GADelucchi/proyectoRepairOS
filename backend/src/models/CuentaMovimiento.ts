import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

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
export type TipoMovimiento = 'cargo' | 'pago' | 'ajuste_debito' | 'ajuste_credito';

/** Los que suman deuda, para armar el saldo y separar la plata real. */
export const TIPOS_QUE_SUMAN: TipoMovimiento[] = ['cargo', 'ajuste_debito'];

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
  medioPago?: MedioPago | null;
  nota?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CuentaMovimientoCreationAttributes = Optional<
  CuentaMovimientoAttributes,
  'id' | 'ordenId' | 'sucursalId' | 'medioPago' | 'nota' | 'createdAt' | 'updatedAt'
>;

export class CuentaMovimiento
  extends Model<CuentaMovimientoAttributes, CuentaMovimientoCreationAttributes>
  implements CuentaMovimientoAttributes
{
  public id!: number;
  public tallerId!: number;
  public clienteId!: number;
  public ordenId!: number | null;
  public sucursalId!: number | null;
  public usuarioId!: number;
  public tipo!: TipoMovimiento;
  // Sequelize devuelve DECIMAL como string para no perder precisión en el camino.
  public monto!: string;
  public medioPago!: MedioPago | null;
  public nota!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

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
          type: DataTypes.ENUM('cargo', 'pago', 'ajuste_debito', 'ajuste_credito'),
          allowNull: false
        },
        monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
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
