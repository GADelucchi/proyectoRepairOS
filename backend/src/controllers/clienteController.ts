import { Request, Response } from 'express';
import { ForeignKeyConstraintError, Op } from 'sequelize';
import { asyncHandler } from '../utils/asyncHandler';
import { paramId } from '../utils/requestParams';
import { HttpError } from '../middlewares/errorHandler';
import { Cliente } from '../models';
import { tallerIdDe } from '../utils/tenant';
import { saldoDeCliente, saldosDeClientes } from '../services/cuentaCorriente';
import { crearClienteSchema, actualizarClienteSchema } from '../validators/clienteValidators';

/**
 * Solo un admin decide a quién se le fía.
 *
 * El campo viaja en el mismo formulario que el resto de los datos del cliente,
 * así que se filtra acá en vez de partir el endpoint en dos. Lo que se rechaza
 * es el cambio, no el envío: un técnico que guarda el resto de los datos
 * reenvía el valor que ya estaba y eso no debería frenarlo.
 */
function exigirAdminParaCuentaCorriente(
  req: Request,
  data: { cuentaCorrienteHabilitada?: boolean },
  valorActual: boolean
): void {
  const nuevo = data.cuentaCorrienteHabilitada;
  if (nuevo !== undefined && nuevo !== valorActual && req.auth?.rol !== 'admin') {
    throw new HttpError(403, 'Solo un administrador puede habilitar la cuenta corriente de un cliente');
  }
}

/**
 * Busca un cliente dentro del taller del usuario o corta con 404.
 *
 * Es 404 y no 403 a propósito: un id de otro taller tiene que ser
 * indistinguible de uno que no existe.
 */
async function buscarClienteDelTaller(req: Request): Promise<Cliente> {
  const cliente = await Cliente.findOne({ where: { id: paramId(req), tallerId: tallerIdDe(req) } });
  if (!cliente) throw new HttpError(404, 'Cliente no encontrado');
  return cliente;
}

export const listarClientes = asyncHandler(async (req: Request, res: Response) => {
  const tallerId = tallerIdDe(req);
  const search = (req.query.search as string | undefined)?.trim();
  const where: any = { tallerId };
  if (search) {
    where[Op.or as any] = [
      { nombre: { [Op.like]: `%${search}%` } },
      { apellido: { [Op.like]: `%${search}%` } },
      { dniCuit: { [Op.like]: `%${search}%` } },
      { telefono: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } }
    ];
  }

  const clientes = await Cliente.findAll({
    where,
    order: [
      ['apellido', 'ASC'],
      ['nombre', 'ASC']
    ],
    limit: 100
  });

  // El saldo de todos los clientes del listado sale de una sola consulta.
  const saldos = await saldosDeClientes(
    tallerId,
    clientes.map((c) => c.id)
  );

  res.json(clientes.map((c) => ({ ...c.get({ plain: true }), saldo: saldos.get(c.id) ?? 0 })));
});

export const obtenerCliente = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await buscarClienteDelTaller(req);
  res.json({
    ...cliente.get({ plain: true }),
    saldo: await saldoDeCliente(tallerIdDe(req), cliente.id)
  });
});

export const crearCliente = asyncHandler(async (req: Request, res: Response) => {
  const data = crearClienteSchema.parse(req.body);
  exigirAdminParaCuentaCorriente(req, data, false);
  const cliente = await Cliente.create({ ...data, tallerId: tallerIdDe(req) });
  res.status(201).json(cliente);
});

export const actualizarCliente = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await buscarClienteDelTaller(req);
  const data = actualizarClienteSchema.parse(req.body);
  exigirAdminParaCuentaCorriente(req, data, cliente.cuentaCorrienteHabilitada);
  await cliente.update(data);
  res.json(cliente);
});

export const eliminarCliente = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await buscarClienteDelTaller(req);
  try {
    await cliente.destroy();
  } catch (err) {
    // Solo el choque contra una clave foránea significa "tiene datos asociados";
    // cualquier otro error tiene que subir tal cual para no ocultar bugs.
    if (err instanceof ForeignKeyConstraintError) {
      throw new HttpError(
        409,
        'No se puede eliminar: el cliente tiene equipos, órdenes o movimientos de cuenta asociados'
      );
    }
    throw err;
  }
  res.status(204).send();
});
