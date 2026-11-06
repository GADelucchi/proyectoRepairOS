import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { MedioPago } from './CuentaMovimiento';
import type { Moneda } from '../shared/utils/dinero';

/**
 * Precio alternativo al de lista: "US$ 100 de lista, $ 120.000 en efectivo".
 * El de lista sigue en la orden. Sirve para mostrárselo al cliente y para
 * proponerlo al entregar; lo que se cobró de verdad queda en la orden.
 */
export interface OrdenPrecioAttributes {
  id: number;
  ordenId: number;
  /** Vacío: vale para cualquier medio de pago. */
  medioPago?: MedioPago | null;
  moneda: Moneda;
  monto: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrdenPrecioCreationAttributes = Optional<
  OrdenPrecioAttributes,
  'id' | 'medioPago' | 'createdAt' | 'updatedAt'
>;

export class OrdenPrecio
  extends Model<OrdenPrecioAttributes, OrdenPrecioCreationAttributes>
  implements OrdenPrecioAttributes
{
  declare id: number;
  declare ordenId: number;
  declare medioPago: MedioPago | null;
  declare moneda: Moneda;
  declare monto: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof OrdenPrecio {
    OrdenPrecio.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        ordenId: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_id' },
        medioPago: { type: DataTypes.STRING(30), allowNull: true, field: 'medio_pago' },
        moneda: { type: DataTypes.STRING(3), allowNull: false },
        monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
      },
      {
        sequelize,
        tableName: 'orden_precios',
        underscored: true
      }
    );
    return OrdenPrecio;
  }
}
