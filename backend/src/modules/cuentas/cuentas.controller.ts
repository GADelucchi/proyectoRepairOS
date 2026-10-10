import { Request, Response } from 'express';
import { paramId, sucursalIdDe, tallerIdDe, usuarioDe, esAdmin } from '../../shared/http/request-context';
import { solicitarAjusteSchema } from '../solicitudes/solicitudes.schemas';
import { pedirAjuste } from '../solicitudes/solicitudes.service';
import { listarCuentasQuery, registrarCobroSchema } from './cuentas.schemas';
import * as cuentas from './cuentas.service';

function clienteDelTaller(req: Request) {
  return cuentas.clienteDelTaller(tallerIdDe(req), paramId(req, 'clienteId'));
}

/** Estado de las cuentas del taller (ver `cuentas.listarCuentas`). */
export async function listarCuentas(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const filtros = listarCuentasQuery.parse(req.query);
  res.json(await cuentas.listarCuentas(tallerId, filtros));
}

/** Cuenta de un cliente con sus saldos por moneda y sus movimientos. */
export async function detalleCuenta(req: Request, res: Response): Promise<void> {
  res.json(await cuentas.detalleCuenta(await clienteDelTaller(req)));
}

/** Cobro contra la cuenta del cliente (ver `cuentas.registrarCobro`). */
export async function registrarCobro(req: Request, res: Response): Promise<void> {
  const cliente = await clienteDelTaller(req);
  const datos = registrarCobroSchema.parse(req.body);
  const { userId } = usuarioDe(req);
  res.status(201).json(await cuentas.registrarCobro(cliente, userId, sucursalIdDe(req), datos));
}

/**
 * Pide un ajuste de saldo. Corregir un saldo cambia lo que el cliente debe sin
 * que entre ni salga plata, así que lo aprueba un admin (o se aplica en el
 * acto si quien lo pide ya es admin).
 */
export async function solicitarAjuste(req: Request, res: Response): Promise<void> {
  const cliente = await clienteDelTaller(req);
  const { monto, moneda, direccion, motivo } = solicitarAjusteSchema.parse(req.body);

  const { solicitud, saldo } = await pedirAjuste(
    {
      tallerId: cliente.tallerId,
      solicitanteId: usuarioDe(req).userId,
      sucursalId: sucursalIdDe(req),
      cliente,
      monto,
      moneda,
      direccion,
      motivo
    },
    esAdmin(req)
  );

  res.status(201).json({ solicitud, aplicada: saldo !== undefined, saldo });
}
