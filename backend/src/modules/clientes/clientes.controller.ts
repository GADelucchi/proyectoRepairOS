import { Request, Response } from 'express';
import { esAdmin, paramId, tallerIdDe } from '../../shared/http/request-context';
import { actualizarClienteSchema, clienteSchema, listarClientesQuery } from './clientes.schemas';
import * as clientes from './clientes.service';

function clienteDelTaller(req: Request) {
  return clientes.clienteDelTaller(tallerIdDe(req), paramId(req));
}

export async function listarClientes(req: Request, res: Response): Promise<void> {
  const tallerId = tallerIdDe(req);
  const { search } = listarClientesQuery.parse(req.query);
  res.json(await clientes.listarClientes(tallerId, search));
}

export async function obtenerCliente(req: Request, res: Response): Promise<void> {
  res.json(await clientes.conSaldos(await clienteDelTaller(req)));
}

export async function crearCliente(req: Request, res: Response): Promise<void> {
  const data = clienteSchema.parse(req.body);
  res.status(201).json(await clientes.crearCliente(tallerIdDe(req), esAdmin(req), data));
}

export async function actualizarCliente(req: Request, res: Response): Promise<void> {
  const cliente = await clienteDelTaller(req);
  clientes.exigirEditable(cliente);
  const data = actualizarClienteSchema.parse(req.body);
  res.json(await clientes.actualizarCliente(cliente, esAdmin(req), data));
}

export async function eliminarCliente(req: Request, res: Response): Promise<void> {
  await clientes.eliminarCliente(await clienteDelTaller(req));
  res.status(204).send();
}

/** Anonimiza un cliente para atender un pedido de supresión (ver `clientes.anonimizarCliente`). */
export async function anonimizarCliente(req: Request, res: Response): Promise<void> {
  const anonimizadoEn = await clientes.anonimizarCliente(await clienteDelTaller(req));
  res.json({ anonimizadoEn: anonimizadoEn.toISOString() });
}
