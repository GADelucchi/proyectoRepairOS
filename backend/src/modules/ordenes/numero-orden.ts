import { Transaction } from 'sequelize';
import { Contador } from '../../models/Contador';

/** Cada taller lleva su propia numeración: ORD-000001 arranca de nuevo en cada uno. */
const claveDe = (tallerId: number) => `orden:${tallerId}`;

/**
 * Reserva el siguiente número de orden con formato ORD-000001.
 *
 * Tiene que ejecutarse dentro de la misma transacción que crea la orden: si esa
 * transacción falla, el número queda libre (ver `Contador.reservarSiguiente`).
 */
export async function generarNumeroOrden(transaction: Transaction, tallerId: number): Promise<string> {
  const siguiente = await Contador.reservarSiguiente(claveDe(tallerId), transaction);
  return `ORD-${String(siguiente).padStart(6, '0')}`;
}
