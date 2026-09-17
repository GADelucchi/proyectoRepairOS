import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import { sequelize, Cliente, CuentaMovimiento, Orden, User } from '../models';
import { tallerIdDe } from '../utils/tenant';
import { redondearMonto, registrarPago, saldoDeCliente, sumaSaldo } from '../services/cuentaCorriente';
import { registrarPagoSchema } from '../validators/cuentaValidators';
import { solicitarAjusteSchema } from '../validators/solicitudValidators';
import { aprobarAjuste, crearSolicitudAjuste } from '../services/solicitudes';

/** Busca un cliente del taller o corta con 404. */
async function clienteDelTaller(req: Request, clienteId: number): Promise<Cliente> {
  const cliente = await Cliente.findOne({ where: { id: clienteId, tallerId: tallerIdDe(req) } });
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');
  return cliente;
}

/**
 * Estado de las cuentas del taller.
 *
 * Por defecto solo trae a los que deben, que es lo que se mira todos los días.
 * Con `?todos=true` aparecen también los que tienen cuenta corriente habilitada
 * y están al día, para poder cobrarles o revisar su historial.
 */
export const listarCuentas = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const search = (req.query.search as string | undefined)?.trim();
  const todos = req.query.todos === 'true';

  const filtroBusqueda = search
    ? `AND (c.nombre LIKE :busqueda OR c.apellido LIKE :busqueda OR c.dni_cuit LIKE :busqueda
            OR c.telefono LIKE :busqueda OR c.nombre_gremio LIKE :busqueda)`
    : '';

  // El saldo se agrupa en la base en vez de traer los movimientos y sumarlos
  // acá: un cliente con años de historia son cientos de filas por renglón.
  const filas = await sequelize.query<{
    id: number;
    nombre: string;
    apellido: string;
    telefono: string | null;
    cuenta_corriente_habilitada: number;
    saldo: string | null;
    ultimo_movimiento: string | null;
  }>(
    `SELECT c.id, c.nombre, c.apellido, c.telefono, c.cuenta_corriente_habilitada,
            COALESCE(${sumaSaldo('m')}, 0) AS saldo,
            MAX(m.created_at) AS ultimo_movimiento
       FROM clientes c
       LEFT JOIN cuenta_movimientos m ON m.cliente_id = c.id AND m.taller_id = :tallerId
      WHERE c.taller_id = :tallerId ${filtroBusqueda}
      GROUP BY c.id, c.nombre, c.apellido, c.telefono, c.cuenta_corriente_habilitada
     HAVING ${todos ? '(saldo <> 0 OR c.cuenta_corriente_habilitada = 1)' : 'saldo <> 0'}
      ORDER BY saldo DESC, c.apellido ASC, c.nombre ASC
      LIMIT 200`,
    {
      replacements: { tallerId, busqueda: `%${search ?? ''}%` },
      type: QueryTypes.SELECT
    }
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

  res.json({
    cuentas,
    totalAdeudado: redondearMonto(cuentas.reduce((total, c) => total + (c.saldo > 0 ? c.saldo : 0), 0))
  });
});

/** Cuenta de un cliente con todos sus movimientos, del más nuevo al más viejo. */
export const detalleCuenta = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const cliente = await clienteDelTaller(req, paramId(req, 'clienteId'));

  const movimientos = await CuentaMovimiento.findAll({
    where: { tallerId, clienteId: cliente.id },
    include: [
      { model: Orden, as: 'orden', attributes: ['id', 'numeroOrden'] },
      { model: User, as: 'usuario', attributes: ['id', 'nombre', 'apellido'] }
    ],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ],
    limit: 300
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
    saldo: await saldoDeCliente(tallerId, cliente.id),
    movimientos
  });
});

/**
 * Cobro contra la cuenta del cliente.
 *
 * El pago va contra el saldo, no contra una orden puntual: en el mostrador el
 * cliente paga "lo que debe", y obligar a repartir el monto entre órdenes sería
 * inventar una imputación que nadie hizo.
 */
export const registrarCobro = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const cliente = await clienteDelTaller(req, paramId(req, 'clienteId'));
  const { monto, medioPago, nota } = registrarPagoSchema.parse(req.body);

  const saldoPrevio = await saldoDeCliente(tallerId, cliente.id);
  if (saldoPrevio <= 0) {
    throw new HttpError(409, 'El cliente no tiene saldo pendiente');
  }
  if (redondearMonto(monto) > saldoPrevio) {
    throw new HttpError(
      409,
      `El cobro supera lo que debe el cliente (saldo actual: ${saldoPrevio.toFixed(2)}).`
    );
  }

  const movimiento = await registrarPago({
    tallerId,
    clienteId: cliente.id,
    usuarioId: req.auth!.userId,
    sucursalId: req.auth?.sucursalId ?? null,
    monto,
    medioPago: medioPago ?? null,
    nota: nota ?? null
  });

  res.status(201).json({
    movimiento,
    saldo: await saldoDeCliente(tallerId, cliente.id)
  });
});

/**
 * Pide un ajuste sobre la cuenta del cliente.
 *
 * Corregir un saldo cambia lo que el cliente debe sin que haya entrado ni salido
 * plata, así que no lo resuelve quien lo detecta: se pide con un motivo y lo
 * aprueba un admin. Cuando el que pide ya es admin se aplica en el acto, pero
 * queda igual la solicitud aprobada, que es el registro de quién lo autorizó.
 */
export const solicitarAjuste = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const cliente = await clienteDelTaller(req, paramId(req, 'clienteId'));
  const { monto, direccion, motivo } = solicitarAjusteSchema.parse(req.body);

  const esAdmin = req.auth?.rol === 'admin';
  const solicitud = await crearSolicitudAjuste({
    tallerId,
    solicitanteId: req.auth!.userId,
    esAdmin,
    sucursalId: req.auth?.sucursalId ?? null,
    cliente,
    monto,
    direccion,
    motivo
  });

  if (!esAdmin) {
    res.status(201).json({ solicitud, aplicada: false });
    return;
  }

  const saldo = await aprobarAjuste(solicitud, req.auth!.userId, 'Autorizada por quien la pidió (admin)');
  res.status(201).json({ solicitud, aplicada: true, saldo });
});
