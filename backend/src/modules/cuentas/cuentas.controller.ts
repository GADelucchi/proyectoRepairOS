import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize, Cliente, CuentaMovimiento, Orden, User } from '../../models';
import { errores } from '../../shared/http/http-error';
import { paramId, sucursalIdDe, tallerIdDe, usuarioDe, esAdmin } from '../../shared/http/request-context';
import { redondearMonto } from '../../shared/utils/dinero';
import { solicitarAjusteSchema } from '../solicitudes/solicitudes.schemas';
import { pedirAjuste } from '../solicitudes/solicitudes.service';
import { bloquearCliente, registrarPago, saldoDeCliente, sumaSaldo } from './cuenta-corriente.service';
import { listarCuentasQuery, registrarCobroSchema } from './cuentas.schemas';

const LIMITE_LISTADO = 200;
const LIMITE_MOVIMIENTOS = 300;

async function clienteDelTaller(req: Request): Promise<Cliente> {
  const cliente = await Cliente.findOne({
    where: { id: paramId(req, 'clienteId'), tallerId: tallerIdDe(req) }
  });
  if (!cliente) throw errores.noEncontrado('Cliente');
  return cliente;
}

interface FilaCuenta {
  id: number;
  nombre: string;
  apellido: string;
  telefono: string | null;
  cuenta_corriente_habilitada: number;
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
 */
export async function listarCuentas(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const { search, todos } = listarCuentasQuery.parse(req.query);

  const filtroBusqueda = search
    ? `AND (c.nombre LIKE :busqueda OR c.apellido LIKE :busqueda OR c.dni_cuit LIKE :busqueda
            OR c.telefono LIKE :busqueda OR c.nombre_gremio LIKE :busqueda)`
    : '';

  const filas = await sequelize.query<FilaCuenta>(
    `SELECT c.id, c.nombre, c.apellido, c.telefono, c.cuenta_corriente_habilitada,
            COALESCE(${sumaSaldo('m')}, 0) AS saldo,
            MAX(m.created_at) AS ultimo_movimiento
       FROM clientes c
       LEFT JOIN cuenta_movimientos m ON m.cliente_id = c.id AND m.taller_id = :tallerId
      WHERE c.taller_id = :tallerId ${filtroBusqueda}
      GROUP BY c.id, c.nombre, c.apellido, c.telefono, c.cuenta_corriente_habilitada
     HAVING ${todos ? '(saldo <> 0 OR c.cuenta_corriente_habilitada = 1)' : 'saldo <> 0'}
      ORDER BY saldo DESC, c.apellido ASC, c.nombre ASC
      LIMIT ${LIMITE_LISTADO}`,
    { replacements: { tallerId, busqueda: `%${search ?? ''}%` }, type: QueryTypes.SELECT }
  );

  const cuentas = filas.map((f) => ({
    clienteId: Number(f.id),
    nombre: f.nombre,
    apellido: f.apellido,
    telefono: f.telefono,
    cuentaCorrienteHabilitada: Boolean(f.cuenta_corriente_habilitada),
    saldo: redondearMonto(Number(f.saldo ?? 0)),
    ultimoMovimiento: f.ultimo_movimiento
  }));

  const totalAdeudado = redondearMonto(cuentas.reduce((total, c) => total + Math.max(c.saldo, 0), 0));
  res.json({ cuentas, totalAdeudado });
}

/** Cuenta de un cliente con sus movimientos, del más nuevo al más viejo. */
export async function detalleCuenta(req: Request, res: Response): Promise<void> {
  const cliente = await clienteDelTaller(req);

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

  res.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      email: cliente.email,
      cuentaCorrienteHabilitada: cliente.cuentaCorrienteHabilitada
    },
    saldo: await saldoDeCliente(cliente.tallerId, cliente.id),
    movimientos
  });
}

/**
 * Cobro contra la cuenta del cliente. Va contra el saldo, no contra una orden:
 * en el mostrador el cliente paga "lo que debe".
 *
 * El saldo se lee y el pago se asienta con el cliente bloqueado, así dos cobros
 * simultáneos no pueden dejar la cuenta con saldo a favor por error.
 */
export async function registrarCobro(req: Request, res: Response): Promise<void> {
  const cliente = await clienteDelTaller(req);
  const { monto, medioPago, nota } = registrarCobroSchema.parse(req.body);

  const movimiento = await sequelize.transaction(async (transaction) => {
    await bloquearCliente(cliente.id, transaction);
    const saldo = await saldoDeCliente(cliente.tallerId, cliente.id, transaction);

    if (saldo <= 0) throw errores.conflicto('El cliente no tiene saldo pendiente');
    if (redondearMonto(monto) > saldo) {
      throw errores.conflicto(`El cobro supera lo que debe el cliente (saldo actual: ${saldo.toFixed(2)}).`);
    }

    return registrarPago({
      tallerId: cliente.tallerId,
      clienteId: cliente.id,
      usuarioId: usuarioDe(req).userId,
      sucursalId: sucursalIdDe(req),
      monto,
      medioPago: medioPago ?? null,
      nota: nota ?? null,
      transaction
    });
  });

  res.status(201).json({ movimiento, saldo: await saldoDeCliente(cliente.tallerId, cliente.id) });
}

/**
 * Pide un ajuste de saldo. Corregir un saldo cambia lo que el cliente debe sin
 * que entre ni salga plata, así que lo aprueba un admin (o se aplica en el
 * acto si quien lo pide ya es admin).
 */
export async function solicitarAjuste(req: Request, res: Response): Promise<void> {
  const cliente = await clienteDelTaller(req);
  const { monto, direccion, motivo } = solicitarAjusteSchema.parse(req.body);

  const { solicitud, saldo } = await pedirAjuste(
    {
      tallerId: cliente.tallerId,
      solicitanteId: usuarioDe(req).userId,
      sucursalId: sucursalIdDe(req),
      cliente,
      monto,
      direccion,
      motivo
    },
    esAdmin(req)
  );

  res.status(201).json({ solicitud, aplicada: saldo !== undefined, saldo });
}
