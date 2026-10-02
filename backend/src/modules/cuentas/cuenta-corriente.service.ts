import { QueryTypes, Transaction } from 'sequelize';
import { sequelize, Cliente, CuentaMovimiento } from '../../models';
import { MedioPago, TipoMovimiento } from '../../models/CuentaMovimiento';
import { HttpError, errores } from '../../shared/http/http-error';
import { redondearMonto } from '../../shared/utils/dinero';
import { nombreCompleto } from '../../shared/utils/texto';

/**
 * Cuenta corriente de los clientes: un libro de movimientos, no un saldo guardado.
 *
 * Saldo positivo = el cliente debe; negativo = tiene plata a favor. Sale siempre
 * de sumar los movimientos: un total en una columna aparte se desincroniza en
 * cuanto un cobro se cae a mitad de camino, y este número tiene que poder
 * justificarse asiento por asiento cuando el cliente lo discute.
 */

/** Expresión SQL del saldo: cargos y ajustes débito suman, el resto resta. */
export function sumaSaldo(alias = ''): string {
  const col = alias ? `${alias}.` : '';
  return `SUM(CASE WHEN ${col}tipo IN ('cargo', 'ajuste_debito') THEN ${col}monto ELSE -${col}monto END)`;
}

export async function saldoDeCliente(
  tallerId: number,
  clienteId: number,
  transaction?: Transaction
): Promise<number> {
  const [fila] = await sequelize.query<{ saldo: string | null }>(
    `SELECT ${sumaSaldo()} AS saldo FROM cuenta_movimientos WHERE taller_id = ? AND cliente_id = ?`,
    { replacements: [tallerId, clienteId], type: QueryTypes.SELECT, transaction }
  );
  return redondearMonto(Number(fila?.saldo ?? 0));
}

/** Saldos de varios clientes en una sola consulta (para los listados). */
export async function saldosDeClientes(tallerId: number, clienteIds: number[]): Promise<Map<number, number>> {
  if (clienteIds.length === 0) return new Map();

  const filas = await sequelize.query<{ cliente_id: number; saldo: string | null }>(
    `SELECT cliente_id, ${sumaSaldo()} AS saldo
       FROM cuenta_movimientos
      WHERE taller_id = ? AND cliente_id IN (?)
      GROUP BY cliente_id`,
    { replacements: [tallerId, clienteIds], type: QueryTypes.SELECT }
  );

  return new Map(filas.map((f) => [Number(f.cliente_id), redondearMonto(Number(f.saldo ?? 0))]));
}

/**
 * Bloquea la fila del cliente hasta que termine la transacción.
 *
 * Toda operación que lee el saldo y después escribe un movimiento pasa por acá:
 * así dos cobros o dos entregas simultáneas del mismo cliente se hacen una
 * detrás de la otra y ninguna calcula sobre un saldo que ya cambió.
 */
export async function bloquearCliente(clienteId: number, transaction: Transaction): Promise<Cliente> {
  const cliente = await Cliente.findByPk(clienteId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!cliente) throw errores.noEncontrado('Cliente');
  return cliente;
}

interface DatosMovimiento {
  tallerId: number;
  clienteId: number;
  usuarioId: number;
  monto: number;
  ordenId?: number | null;
  sucursalId?: number | null;
  medioPago?: MedioPago | null;
  nota?: string | null;
  transaction?: Transaction;
}

function crearMovimiento(tipo: TipoMovimiento, datos: DatosMovimiento): Promise<CuentaMovimiento> {
  const monto = redondearMonto(datos.monto);
  if (!(monto > 0)) throw errores.solicitudInvalida('El monto del movimiento debe ser mayor a cero');

  return CuentaMovimiento.create(
    {
      tallerId: datos.tallerId,
      clienteId: datos.clienteId,
      ordenId: datos.ordenId ?? null,
      sucursalId: datos.sucursalId ?? null,
      usuarioId: datos.usuarioId,
      tipo,
      monto: monto.toFixed(2),
      medioPago: datos.medioPago ?? null,
      nota: datos.nota ?? null
    },
    { transaction: datos.transaction }
  );
}

/** Deuda nueva (lo facturado al entregar un equipo). */
export const registrarCargo = (datos: DatosMovimiento) => crearMovimiento('cargo', datos);

/** Plata que entró y descuenta deuda. */
export const registrarPago = (datos: DatosMovimiento) => crearMovimiento('pago', datos);

/**
 * Corrección del saldo sin que haya entrado ni salido plata. `debito` suma
 * deuda y `credito` la descuenta. Solo se llega acá con autorización de un admin.
 */
export const registrarAjuste = (direccion: 'debito' | 'credito', datos: DatosMovimiento) =>
  crearMovimiento(direccion === 'debito' ? 'ajuste_debito' : 'ajuste_credito', datos);

/** Plata a favor disponible: el saldo negativo es crédito del cliente. */
export function creditoDisponible(saldo: number): number {
  return saldo < 0 ? redondearMonto(-saldo) : 0;
}

/**
 * Cuánto saldo a favor cubre una entrega y cuánta deuda nueva queda.
 *
 * El crédito ya está en el libro como saldo negativo, así que el cargo de la
 * entrega lo consume sin asientos extra. Lo que importa es qué parte quedó
 * cubierta, porque de eso depende si el cliente queda debiendo.
 */
export function repartirEntrega(
  saldoPrevio: number,
  total: number,
  abonado: number
): { creditoAplicado: number; pendiente: number } {
  const sinCubrir = Math.max(0, redondearMonto(total - abonado));
  const creditoAplicado = redondearMonto(Math.min(creditoDisponible(saldoPrevio), sinCubrir));
  return { creditoAplicado, pendiente: redondearMonto(sinCubrir - creditoAplicado) };
}

/**
 * Corta si el cliente no puede quedar debiendo. Fiar es una decisión del dueño:
 * sin cuenta corriente habilitada, la entrega tiene que cobrarse entera.
 *
 * Viaja con `REQUIERE_AUTORIZACION` para que el mostrador tenga salida: la
 * pantalla ofrece pedirle permiso a un supervisor en vez de solo negarse.
 */
export function exigirCuentaCorriente(cliente: Cliente, pendiente: number): void {
  if (pendiente > 0 && !cliente.cuentaCorrienteHabilitada) {
    throw new HttpError(409, `${nombreCompleto(cliente)} no tiene cuenta corriente habilitada.`, {
      codigo: 'REQUIERE_AUTORIZACION',
      requiereAutorizacion: true,
      pendiente
    });
  }
}
