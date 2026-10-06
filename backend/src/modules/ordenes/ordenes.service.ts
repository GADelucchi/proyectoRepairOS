import { Includeable, Op, Transaction, WhereOptions } from 'sequelize';
import {
  sequelize,
  Cliente,
  Equipo,
  Orden,
  OrdenChequeo,
  OrdenHistorialEstado,
  OrdenImagen,
  Sucursal,
  TipoEquipoPersonalizado,
  User
} from '../../models';
import { EstadoOrden, OrdenAttributes } from '../../models/Orden';
import { OPCIONES_CHEQUEO_POR_DEFECTO } from '../../models/OrdenChequeo';
import { errores } from '../../shared/http/http-error';
import { exigirTipoDelTaller } from '../configuracion/tipos-equipo.service';
import { cifrarCredenciales } from '../equipos/equipos.service';
import { generarNumeroSerieUnico } from '../equipos/numero-serie';
import { esEstadoFinal, etiquetaEstado } from './estado-orden';
import { generarNumeroOrden } from './numero-orden';
import { MONEDA_POR_DEFECTO } from '../../shared/utils/dinero';
import { ChequeoInput, crearOrdenSchema, listarOrdenesQuery } from './ordenes.schemas';
import type { z } from 'zod';

const USUARIO_RESUMIDO = ['id', 'nombre', 'apellido'];

/** Todo lo que muestra el detalle de una orden (y el remito en PDF). */
export const INCLUDES_DETALLE: Includeable[] = [
  { model: Cliente, as: 'cliente' },
  {
    model: Equipo,
    as: 'equipo',
    include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }]
  },
  { model: Sucursal, as: 'sucursal' },
  { model: User, as: 'tecnico', attributes: USUARIO_RESUMIDO },
  { model: OrdenChequeo, as: 'chequeos', separate: true, order: [['orden', 'ASC']] },
  { model: OrdenImagen, as: 'imagenes', separate: true, order: [['createdAt', 'ASC']] },
  {
    model: OrdenHistorialEstado,
    as: 'historialEstados',
    separate: true,
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'usuario', attributes: USUARIO_RESUMIDO }]
  }
];

/** Lo que muestra cada renglón del listado de órdenes. */
export const INCLUDES_LISTADO: Includeable[] = [
  { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido', 'telefono', 'dniCuit'] },
  {
    model: Equipo,
    as: 'equipo',
    attributes: ['id', 'tipoEquipoPersonalizadoId', 'marca', 'modelo', 'color', 'numeroSerie'],
    include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }]
  }
];

/** Columnas (de la orden y de sus includes) en las que busca el listado. */
const COLUMNAS_BUSQUEDA = [
  'Orden.numero_orden',
  'equipo.numero_serie',
  'equipo.modelo',
  'equipo.color',
  'cliente.telefono',
  'cliente.dni_cuit'
];

/**
 * Filtro del listado de órdenes de una sucursal.
 *
 * La búsqueda pega contra columnas de las tablas incluidas, así que solo sirve
 * con `INCLUDES_LISTADO` (cliente y equipo unidos en la misma consulta). El
 * nombre se busca completo en los dos órdenes, para que "Juan Pérez" y "Pérez
 * Juan" encuentren lo mismo.
 */
export function filtroDeOrdenes(
  sucursalId: number,
  { estado, search, equipoId }: z.infer<typeof listarOrdenesQuery>
): WhereOptions<OrdenAttributes> {
  const where: WhereOptions<OrdenAttributes> = {
    sucursalId,
    ...(estado ? { estado } : {}),
    ...(equipoId ? { equipoId } : {})
  };
  if (!search) return where;

  const patron = { [Op.like]: `%${search}%` };
  const col = (columna: string) => sequelize.col(columna);
  return {
    ...where,
    [Op.or]: [
      ...COLUMNAS_BUSQUEDA.map((columna) => sequelize.where(col(columna), patron)),
      sequelize.where(sequelize.fn('CONCAT', col('cliente.nombre'), ' ', col('cliente.apellido')), patron),
      sequelize.where(sequelize.fn('CONCAT', col('cliente.apellido'), ' ', col('cliente.nombre')), patron)
    ]
  };
}

/**
 * Busca una orden de la sucursal activa o corta con 404.
 *
 * Las órdenes se ven desde la sucursal que las recibió: un técnico de otra
 * sucursal del mismo taller no las encuentra.
 */
export async function buscarOrdenDeSucursal(
  id: number,
  sucursalId: number,
  opciones: { include?: Includeable[]; conFirma?: boolean } = {}
): Promise<Orden> {
  const modelo = opciones.conFirma ? Orden.scope('conFirma') : Orden;
  const orden = await modelo.findOne({ where: { id, sucursalId }, include: opciones.include });
  if (!orden) throw errores.noEncontrado('Orden');
  return orden;
}

/**
 * Una orden entregada o cancelada no se edita más, salvo que lo haga un admin
 * (para corregir un dato mal cargado). La pantalla ya lo bloquea; esto evita
 * que alguien lo saltee pegando directo a la API.
 */
export function exigirEditable(orden: Orden, esAdmin: boolean): void {
  if (esEstadoFinal(orden.estado) && !esAdmin) {
    throw errores.conflicto(
      `La orden está ${etiquetaEstado(orden.estado).toLowerCase()}: solo un administrador puede modificarla`
    );
  }
}

/** Filas de checklist listas para guardar, con las opciones congeladas. */
export function filasDeChequeo(ordenId: number, chequeos: ChequeoInput[]) {
  return chequeos.map((c, indice) => ({
    ordenId,
    item: c.item,
    resultado: c.resultado ?? null,
    // Se congelan las opciones con las que se recibió el equipo: una orden vieja
    // sigue mostrando sus alternativas aunque después se edite el checklist.
    opciones: c.opciones ?? OPCIONES_CHEQUEO_POR_DEFECTO,
    orden: c.orden ?? indice
  }));
}

export async function registrarCambioDeEstado(
  datos: {
    ordenId: number;
    estadoAnterior: EstadoOrden | null;
    estadoNuevo: EstadoOrden;
    usuarioId: number;
    comentario?: string | null;
    notaInterna?: string | null;
  },
  transaction?: Transaction
): Promise<void> {
  await OrdenHistorialEstado.create(
    { ...datos, comentario: datos.comentario ?? null, notaInterna: datos.notaInterna ?? null },
    { transaction }
  );
}

type NuevaOrden = z.infer<typeof crearOrdenSchema>;

interface ContextoAlta {
  tallerId: number;
  sucursalId: number;
  usuarioId: number;
  esAdmin: boolean;
}

async function resolverCliente(
  data: NuevaOrden,
  ctx: ContextoAlta,
  transaction: Transaction
): Promise<number> {
  if (data.clienteId) {
    const existe = await Cliente.count({
      where: { id: data.clienteId, tallerId: ctx.tallerId },
      transaction
    });
    if (!existe) throw errores.noEncontrado('Cliente');
    return data.clienteId;
  }
  const datosCliente = data.nuevoCliente!;
  if (datosCliente.cuentaCorrienteHabilitada && !ctx.esAdmin) {
    throw errores.sinPermiso('Solo un administrador puede habilitar la cuenta corriente de un cliente');
  }
  const nuevo = await Cliente.create({ ...datosCliente, tallerId: ctx.tallerId }, { transaction });
  return nuevo.id;
}

async function resolverEquipo(
  data: NuevaOrden,
  clienteId: number,
  ctx: ContextoAlta,
  transaction: Transaction
): Promise<number> {
  if (data.equipoId) {
    const equipo = await Equipo.findOne({
      where: { id: data.equipoId, tallerId: ctx.tallerId },
      transaction
    });
    if (!equipo) throw errores.noEncontrado('Equipo');
    if (equipo.clienteId !== clienteId) {
      throw errores.solicitudInvalida('El equipo elegido pertenece a otro cliente');
    }
    return equipo.id;
  }

  const { claveDesbloqueo, cuentaUsuario, cuentaPassword, ...datos } = data.nuevoEquipo!;
  await exigirTipoDelTaller(datos.tipoEquipoPersonalizadoId, ctx.tallerId, transaction);

  const nuevo = await Equipo.create(
    {
      ...datos,
      numeroSerie: datos.numeroSerie || (await generarNumeroSerieUnico(ctx.tallerId)),
      tallerId: ctx.tallerId,
      clienteId,
      ...cifrarCredenciales({ claveDesbloqueo, cuentaUsuario, cuentaPassword })
    },
    { transaction }
  );
  return nuevo.id;
}

/**
 * Alta de una orden con su cliente y equipo (existentes o nuevos), su checklist
 * y el primer renglón del historial, todo en una transacción. El número de orden
 * se reserva dentro de la misma transacción (ver `numero-orden.ts`).
 */
export async function crearOrden(data: NuevaOrden, ctx: ContextoAlta): Promise<Orden> {
  const ordenId = await sequelize.transaction(async (transaction) => {
    const clienteId = await resolverCliente(data, ctx, transaction);
    const equipoId = await resolverEquipo(data, clienteId, ctx, transaction);

    const orden = await Orden.create(
      {
        tallerId: ctx.tallerId,
        numeroOrden: await generarNumeroOrden(transaction, ctx.tallerId),
        clienteId,
        equipoId,
        sucursalId: ctx.sucursalId,
        tecnicoId: ctx.usuarioId,
        estado: 'recibido',
        detallesEsteticos: data.detallesEsteticos ?? null,
        reparacionSolicitada: data.reparacionSolicitada,
        notasInternas: data.notasInternas ?? null,
        fechaPactada: data.fechaPactada,
        presupuestoMonto: data.presupuestoMonto ?? null,
        moneda: data.moneda ?? MONEDA_POR_DEFECTO
      },
      { transaction }
    );

    await OrdenChequeo.bulkCreate(filasDeChequeo(orden.id, data.chequeos), { transaction });
    await registrarCambioDeEstado(
      {
        ordenId: orden.id,
        estadoAnterior: null,
        estadoNuevo: 'recibido',
        usuarioId: ctx.usuarioId,
        comentario: 'Orden creada'
      },
      transaction
    );
    return orden.id;
  });

  return buscarOrdenDeSucursal(ordenId, ctx.sucursalId, { include: INCLUDES_DETALLE });
}
