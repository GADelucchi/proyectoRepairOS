import { DataTypes, Model, Optional, QueryTypes, Sequelize, Transaction } from 'sequelize';

export interface ContadorAttributes {
  clave: string;
  valor: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ContadorCreationAttributes = Optional<ContadorAttributes, 'valor' | 'createdAt' | 'updatedAt'>;

/** Secuencias del sistema: el número de orden y el de stock de cada taller. */
export class Contador
  extends Model<ContadorAttributes, ContadorCreationAttributes>
  implements ContadorAttributes
{
  declare clave: string;
  declare valor: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  /**
   * Reserva el siguiente valor de la secuencia `clave`.
   *
   * Toma la fila con `SELECT ... FOR UPDATE`, que bloquea a cualquier otra
   * transacción que quiera el mismo número hasta que esta termine: dos altas
   * simultáneas no compiten, la segunda espera y recibe el siguiente.
   *
   * Tiene que ejecutarse dentro de la transacción que usa el número. Si esa
   * transacción falla, el contador vuelve atrás con ella y el número queda libre.
   */
  static async reservarSiguiente(clave: string, transaction: Transaction): Promise<number> {
    const sequelize = Contador.sequelize!;
    const filas = await sequelize.query<{ valor: string | number }>(
      'SELECT valor FROM contadores WHERE clave = ? FOR UPDATE',
      { replacements: [clave], type: QueryTypes.SELECT, transaction }
    );
    const fila = filas[0];

    // Si la fila todavía no existe (primer número o base creada a mano), se inicializa en cero.
    if (!fila) {
      await Contador.create({ clave, valor: 0 }, { transaction });
    }

    const siguiente = (fila ? Number(fila.valor) : 0) + 1;
    await sequelize.query('UPDATE contadores SET valor = ?, updated_at = NOW() WHERE clave = ?', {
      replacements: [siguiente, clave],
      transaction
    });
    return siguiente;
  }

  static initModel(sequelize: Sequelize): typeof Contador {
    Contador.init(
      {
        clave: { type: DataTypes.STRING(50), primaryKey: true },
        valor: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 }
      },
      {
        sequelize,
        tableName: 'contadores',
        underscored: true
      }
    );
    return Contador;
  }
}
