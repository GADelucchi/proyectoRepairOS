import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { Contador } from '../../models/Contador';

/** Cada taller lleva su propia numeración: ORD-000001 arranca de nuevo en cada uno. */
const claveDe = (tallerId: number) => `orden:${tallerId}`;

/**
 * Reserva el siguiente número de orden con formato ORD-000001.
 *
 * Toma la fila del contador con `SELECT ... FOR UPDATE`, que bloquea a cualquier
 * otra transacción que quiera el mismo número hasta que esta termine. Dos altas
 * simultáneas no compiten: la segunda espera y recibe el número siguiente.
 *
 * Tiene que ejecutarse dentro de la misma transacción que crea la orden. Si esa
 * transacción falla, el contador vuelve atrás junto con ella y el número queda
 * libre; si tiene éxito, el número ya está reservado y nadie más lo puede tomar.
 */
export async function generarNumeroOrden(transaction: Transaction, tallerId: number): Promise<string> {
  const clave = claveDe(tallerId);

  const filas = await sequelize.query<{ valor: string | number }>(
    'SELECT valor FROM contadores WHERE clave = ? FOR UPDATE',
    { replacements: [clave], type: QueryTypes.SELECT, transaction }
  );
  const fila = filas[0];

  // Si la fila todavía no existe (base creada a mano), se inicializa en cero.
  if (!fila) {
    await Contador.create({ clave, valor: 0 }, { transaction });
  }

  const siguiente = (fila ? Number(fila.valor) : 0) + 1;

  await sequelize.query('UPDATE contadores SET valor = ?, updated_at = NOW() WHERE clave = ?', {
    replacements: [siguiente, clave],
    transaction
  });

  return `ORD-${String(siguiente).padStart(6, '0')}`;
}
