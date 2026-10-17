import { ForeignKeyConstraintError, Op, QueryTypes, WhereOptions } from 'sequelize';
import { z } from 'zod';
import { sequelize, Cliente, Equipo, Orden } from '../../models';
import { ClienteAttributes } from '../../models/Cliente';
import { errores } from '../../shared/http/http-error';
import { saldosDeCliente, saldosDeClientes } from '../cuentas/cuenta-corriente.service';
import { actualizarClienteSchema, clienteSchema } from './clientes.schemas';
import { clasificarOrden, contarOrdenes, FilaOrdenCliente } from './resumen';

const LIMITE_LISTADO = 100;

/**
 * Solo un admin decide a quién se le fía.
 *
 * Se rechaza el cambio, no el envío: un técnico que edita el resto de los datos
 * reenvía el valor que ya estaba y eso no tiene que frenarlo.
 */
function exigirAdminParaCuentaCorriente(
  esAdmin: boolean,
  nuevoValor: boolean | undefined,
  valorActual: boolean
): void {
  if (nuevoValor !== undefined && nuevoValor !== valorActual && !esAdmin) {
    throw errores.sinPermiso('Solo un administrador puede habilitar la cuenta corriente de un cliente');
  }
}

/**
 * Busca un cliente del taller o corta con 404. Es 404 y no 403 a propósito: un
 * id de otro taller tiene que ser indistinguible de uno que no existe.
 */
export async function clienteDelTaller(tallerId: number, id: number): Promise<Cliente> {
  const cliente = await Cliente.findOne({ where: { id, tallerId } });
  if (!cliente) throw errores.noEncontrado('Cliente');
  return cliente;
}

export async function listarClientes(tallerId: number, search?: string) {
  const where: WhereOptions<ClienteAttributes> = search
    ? {
        tallerId,
        [Op.or]: ['nombre', 'apellido', 'dniCuit', 'telefono', 'email', 'ciudad'].map((campo) => ({
          [campo]: { [Op.like]: `%${search}%` }
        }))
      }
    : { tallerId };

  const clientes = await Cliente.findAll({
    where,
    order: [
      ['apellido', 'ASC'],
      ['nombre', 'ASC']
    ],
    limit: LIMITE_LISTADO
  });

  const saldos = await saldosDeClientes(
    tallerId,
    clientes.map((c) => c.id)
  );
  return clientes.map((c) => ({ ...c.get({ plain: true }), saldos: saldos.get(c.id) ?? [] }));
}

/** Una orden del cliente tal como sale de la consulta del resumen. */
interface FilaResumen extends FilaOrdenCliente {
  id: number;
  numeroOrden: string;
  fechaIngreso: Date;
  sucursalId: number;
  sucursal: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
}

/**
 * Resumen de un cliente: sus datos, el saldo de la cuenta corriente, cuántas
 * órdenes trajo y cómo terminaron, y la lista de esas órdenes (la más nueva
 * primero) para ver las de cada recuadro. Incluye las de todas las sucursales:
 * el cliente es del taller.
 */
export async function resumenCliente(cliente: Cliente) {
  const filas = await sequelize.query<FilaResumen>(
    `SELECT o.id, o.numero_orden AS numeroOrden, o.estado, o.fecha_ingreso AS fechaIngreso,
            o.presupuesto_aprobado AS presupuestoAprobado, o.sucursal_id AS sucursalId,
            s.nombre AS sucursal, e.marca, e.modelo, e.color,
            (SELECT h.estado_nuevo FROM orden_historial_estados h
              WHERE h.orden_id = o.id AND h.estado_nuevo IN ('listo_para_retirar', 'no_reparado')
              ORDER BY h.created_at DESC, h.id DESC LIMIT 1) AS resultado
       FROM ordenes o
       JOIN sucursales s ON s.id = o.sucursal_id
       JOIN equipos e ON e.id = o.equipo_id
      WHERE o.taller_id = :tallerId AND o.cliente_id = :clienteId
      ORDER BY o.fecha_ingreso DESC, o.id DESC`,
    { replacements: { tallerId: cliente.tallerId, clienteId: cliente.id }, type: QueryTypes.SELECT }
  );
  return {
    cliente: await conSaldos(cliente),
    ordenes: contarOrdenes(filas),
    ultimaVisita: filas[0]?.fechaIngreso ?? null,
    listado: filas.map((f) => ({
      id: f.id,
      numeroOrden: f.numeroOrden,
      estado: f.estado,
      fechaIngreso: f.fechaIngreso,
      sucursal: { id: f.sucursalId, nombre: f.sucursal },
      equipo: { marca: f.marca, modelo: f.modelo, color: f.color },
      ...clasificarOrden(f)
    }))
  };
}

/** El cliente con sus saldos de cuenta corriente. */
export async function conSaldos(cliente: Cliente) {
  return { ...cliente.get({ plain: true }), saldos: await saldosDeCliente(cliente.tallerId, cliente.id) };
}

export function crearCliente(
  tallerId: number,
  esAdmin: boolean,
  data: z.infer<typeof clienteSchema>
): Promise<Cliente> {
  exigirAdminParaCuentaCorriente(esAdmin, data.cuentaCorrienteHabilitada, false);
  return Cliente.create({ ...data, tallerId });
}

export function exigirEditable(cliente: Cliente): void {
  if (cliente.anonimizadoEn) throw errores.conflicto('El cliente fue anonimizado y no se puede editar');
}

export async function actualizarCliente(
  cliente: Cliente,
  esAdmin: boolean,
  data: z.infer<typeof actualizarClienteSchema>
): Promise<Cliente> {
  exigirEditable(cliente);
  exigirAdminParaCuentaCorriente(esAdmin, data.cuentaCorrienteHabilitada, cliente.cuentaCorrienteHabilitada);
  return cliente.update(data);
}

export async function eliminarCliente(cliente: Cliente): Promise<void> {
  try {
    await cliente.destroy();
  } catch (err) {
    // La clave foránea es la que sabe si tiene datos asociados.
    if (err instanceof ForeignKeyConstraintError) {
      throw errores.conflicto(
        'No se puede eliminar: el cliente tiene equipos, órdenes o movimientos de cuenta asociados'
      );
    }
    throw err;
  }
}

/**
 * Anonimiza un cliente para atender un pedido de supresión (art. 16, Ley 25.326).
 *
 * Borrar la fila no es posible: tiene órdenes y movimientos que la normativa
 * contable obliga a conservar. Lo que se hace es cortar el vínculo con una
 * persona identificable: se reemplazan sus datos y se eliminan las claves de
 * desbloqueo, las credenciales de cuentas y las firmas de sus órdenes.
 *
 * Es irreversible. `anonimizadoEn` queda como constancia de cuándo se ejerció
 * el derecho. Las fotos de los equipos no se tocan: son del equipo, no del titular.
 */
export async function anonimizarCliente(cliente: Cliente): Promise<Date> {
  if (cliente.anonimizadoEn) throw errores.conflicto('El cliente ya fue anonimizado');

  const anonimizadoEn = new Date();

  await sequelize.transaction(async (transaction) => {
    await cliente.update(
      {
        nombre: 'Cliente',
        apellido: `anonimizado #${cliente.id}`,
        dniCuit: null,
        telefono: null,
        email: null,
        direccion: null,
        ciudad: null,
        fechaNacimiento: null,
        nombreGremio: null,
        anonimizadoEn
      },
      { transaction }
    );

    await Equipo.update(
      { claveDesbloqueoEnc: null, cuentaUsuarioEnc: null, cuentaPasswordEnc: null },
      { where: { clienteId: cliente.id }, transaction }
    );

    // `conFirma` porque el scope por defecto excluye la columna de la firma. Se
    // borra también la fecha: si quedara, la pantalla pediría una imagen que ya no existe.
    await Orden.scope('conFirma').update(
      { firmaClienteEnc: null, firmaClienteUrl: null, firmaClienteAt: null },
      { where: { clienteId: cliente.id }, transaction }
    );
  });

  return anonimizadoEn;
}
