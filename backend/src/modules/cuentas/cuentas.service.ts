import { QueryTypes } from 'sequelize';
import { z } from 'zod';
import { sequelize, Cliente, CuentaMovimiento, Orden, User } from '../../models';
import { errores } from '../../shared/http/http-error';
import { MONEDA_POR_DEFECTO, Moneda, montoConMoneda, redondearMonto } from '../../shared/utils/dinero';
import {
  bloquearCliente,
  registrarPago,
  saldoDeCliente,
  saldosDeCliente,
  sumaSaldo
} from './cuenta-corriente.service';
import { listarCuentasQuery, registrarCobroSchema } from './cuentas.schemas';

const LIMITE_LISTADO = 200;
const LIMITE_MOVIMIENTOS = 300;

export async function clienteDelTaller(tallerId: number, id: number): Promise<Cliente> {
  const cliente = await Cliente.findOne({ where: { id, tallerId } });
  if (!cliente) throw errores.noEncontrado('Cliente');
  return cliente;
}

interface FilaCuenta {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string | null;
  cuenta_corriente_habilitada: number;
  moneda: Moneda;
  saldo: string | null;
  ultimo_movimiento: string | null;
}

/**
 * Estado de las cuentas del taller. Por defecto solo los que deben, que es lo
 * que se mira todos los días; con `?todos=true` también los que tienen cuenta
 * habilitada y están al día.
 *
 * El saldo se agrupa en la base: un cliente con años de historia son cientos
 * de movimientos por renglón.
 *
 * Hay un renglón por cliente y moneda: quien debe pesos y dólares aparece dos
 * veces, y el total adeudado se informa por separado en cada moneda.
 */
export async function listarCuentas(tallerId: number, { search, todos }: z.infer<typeof listarCuentasQuery>) {
  const filtroBusqueda = search
    ? `AND (c.nombre LIKE :busqueda OR c.apellido LIKE :busqueda OR c.dni_cuit LIKE :busqueda
            OR c.telefono LIKE :busqueda OR c.nombre_gremio LIKE :busqueda)`
    : '';

  const filas = await sequelize.query<FilaCuenta>(
    `SELECT c.id, c.nombre, c.apellido, c.telefono, c.cuenta_corriente_habilitada,
            COALESCE(m.moneda, :monedaPorDefecto) AS moneda,
            COALESCE(${sumaSaldo('m')}, 0) AS saldo,
            MAX(m.created_at) AS ultimo_movimiento
       FROM clientes c
       LEFT JOIN cuenta_movimientos m ON m.cliente_id = c.id AND m.taller_id = :tallerId
      WHERE c.taller_id = :tallerId ${filtroBusqueda}
      GROUP BY c.id, c.nombre, c.apellido, c.telefono, c.cuenta_corriente_habilitada,
               COALESCE(m.moneda, :monedaPorDefecto)
     HAVING ${todos ? '(saldo <> 0 OR c.cuenta_corriente_habilitada = 1)' : 'saldo <> 0'}
      ORDER BY saldo DESC, c.apellido ASC, c.nombre ASC
      LIMIT ${LIMITE_LISTADO}`,
    {
      replacements: { tallerId, busqueda: `%${search ?? ''}%`, monedaPorDefecto: MONEDA_POR_DEFECTO },
      type: QueryTypes.SELECT
    }
  );

  const cuentas = filas.map((f) => ({
    clienteId: Number(f.id),
    nombre: f.nombre,
    apellido: f.apellido,
    telefono: f.telefono,
    cuentaCorrienteHabilitada: Boolean(f.cuenta_corriente_habilitada),
    moneda: f.moneda,
    saldo: redondearMonto(Number(f.saldo ?? 0)),
    ultimoMovimiento: f.ultimo_movimiento
  }));

  const totales = new Map<Moneda, number>();
  for (const c of cuentas) {
    if (c.saldo > 0) totales.set(c.moneda, redondearMonto((totales.get(c.moneda) ?? 0) + c.saldo));
  }
  const totalesAdeudados = [...totales].map(([moneda, total]) => ({ moneda, total }));
  return { cuentas, totalesAdeudados };
}

/** Cuenta de un cliente con sus saldos por moneda y sus movimientos, del más nuevo al más viejo. */
export async function detalleCuenta(cliente: Cliente) {
  const movimientos = await CuentaMovimiento.findAll({
    where: { tallerId: cliente.tallerId, clienteId: cliente.id },
    include: [
      { model: Orden, as: 'orden', attributes: ['id', 'numeroOrden'] },
      { model: User, as: 'usuario', attributes: ['id', 'nombre', 'apellido'] }
    ],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ],
    limit: LIMITE_MOVIMIENTOS
  });

  return {
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      email: cliente.email,
      cuentaCorrienteHabilitada: cliente.cuentaCorrienteHabilitada
    },
    saldos: await saldosDeCliente(cliente.tallerId, cliente.id),
    movimientos
  };
}

/**
 * Cobro contra la cuenta del cliente. Va contra el saldo, no contra una orden:
 * en el mostrador el cliente paga "lo que debe".
 *
 * El saldo se lee y el pago se asienta con el cliente bloqueado, así dos cobros
 * simultáneos no pueden dejar la cuenta con saldo a favor por error.
 */
export async function registrarCobro(
  cliente: Cliente,
  usuarioId: number,
  sucursalId: number,
  { monto, moneda, medioPago, nota }: z.infer<typeof registrarCobroSchema>
) {
  const movimiento = await sequelize.transaction(async (transaction) => {
    await bloquearCliente(cliente.id, transaction);
    const saldo = await saldoDeCliente(cliente.tallerId, cliente.id, moneda, transaction);

    if (saldo <= 0) throw errores.conflicto(`El cliente no tiene saldo pendiente en ${moneda}`);
    if (redondearMonto(monto) > saldo) {
      throw errores.conflicto(
        `El cobro supera lo que debe el cliente (saldo actual: ${montoConMoneda(saldo, moneda)}).`
      );
    }

    return registrarPago({
      tallerId: cliente.tallerId,
      clienteId: cliente.id,
      usuarioId,
      sucursalId,
      monto,
      moneda,
      medioPago: medioPago ?? null,
      nota: nota ?? null,
      transaction
    });
  });

  return { movimiento, saldo: await saldoDeCliente(cliente.tallerId, cliente.id, moneda) };
}
