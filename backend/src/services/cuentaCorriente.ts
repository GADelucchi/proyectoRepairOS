import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { CuentaMovimiento, Cliente } from '../models';
import { MedioPago, TipoMovimiento } from '../models/CuentaMovimiento';
import { HttpError } from '../middlewares/errorHandler';

/**
 * Saldo de la cuenta corriente de un cliente.
 *
 * Positivo = el cliente debe; negativo = tiene plata a favor. Sale siempre de
 * sumar los movimientos, nunca de una columna acumulada: un total guardado
 * aparte se desincroniza en cuanto un cobro se cae a mitad de camino, y este
 * número tiene que poder mostrarse movimiento por movimiento cuando el cliente
 * lo discute.
 */
export function sumaSaldo(alias = ''): string {
  const col = alias ? `${alias}.` : '';
  return `SUM(CASE WHEN ${col}tipo IN ('cargo', 'ajuste_debito') THEN ${col}monto ELSE -${col}monto END)`;
}

/** Redondea a dos decimales, que es la precisión con la que se guarda la plata. */
export function redondearMonto(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
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

/**
 * Saldos de varios clientes de una sola consulta.
 *
 * Los listados muestran el saldo en cada fila; pedirlo cliente por cliente
 * convertía la pantalla en una consulta por renglón.
 */
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

/** Anota deuda nueva (lo facturado al entregar un equipo). */
export function registrarCargo(datos: DatosMovimiento): Promise<CuentaMovimiento> {
  return crearMovimiento('cargo', datos);
}

/** Descuenta plata de la cuenta (un cobro). */
export function registrarPago(datos: DatosMovimiento): Promise<CuentaMovimiento> {
  return crearMovimiento('pago', datos);
}

/**
 * Corrige el saldo sin que haya entrado ni salido plata.
 *
 * `debito` suma deuda y `credito` la descuenta. Solo se llega acá desde una
 * solicitud aprobada por un admin: quien atiende el mostrador puede pedir el
 * ajuste, no hacerlo.
 */
export function registrarAjuste(
  direccion: 'debito' | 'credito',
  datos: DatosMovimiento
): Promise<CuentaMovimiento> {
  return crearMovimiento(direccion === 'debito' ? 'ajuste_debito' : 'ajuste_credito', datos);
}

function crearMovimiento(tipo: TipoMovimiento, datos: DatosMovimiento): Promise<CuentaMovimiento> {
  const monto = redondearMonto(datos.monto);
  if (!(monto > 0)) {
    throw new HttpError(400, 'El monto del movimiento debe ser mayor a cero');
  }

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

/** Plata a favor disponible. El saldo negativo es crédito del cliente. */
export function creditoDisponible(saldo: number): number {
  return saldo < 0 ? redondearMonto(-saldo) : 0;
}

/**
 * Cuánto saldo a favor cubre esta entrega y cuánta deuda nueva queda.
 *
 * El crédito se aplica solo: ya está en el libro como saldo negativo, así que
 * el cargo de la entrega lo consume sin necesidad de asientos extra. Lo que
 * importa calcular es qué parte quedó cubierta, porque de eso depende si la
 * operación deja al cliente debiendo o no.
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
 * Corta si el cliente no puede quedar debiendo.
 *
 * Fiar es una decisión del dueño, no un descuido del mostrador: si la cuenta
 * corriente no está habilitada, la entrega tiene que cobrarse entera.
 */
export function exigirCuentaCorriente(cliente: Cliente, pendiente: number): void {
  if (pendiente > 0 && !cliente.cuentaCorrienteHabilitada) {
    // Viaja con `requiereAutorizacion` para que el mostrador tenga salida: la
    // pantalla ofrece pedirle permiso a un supervisor en vez de solo negarse.
    throw new HttpError(409, `${cliente.nombre} ${cliente.apellido} no tiene cuenta corriente habilitada.`, {
      requiereAutorizacion: true,
      pendiente
    });
  }
}
