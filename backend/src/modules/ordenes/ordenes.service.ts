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
  Taller,
  TipoEquipoPersonalizado,
  User
} from '../../models';
import { EstadoOrden, OrdenAttributes } from '../../models/Orden';
import { OPCIONES_CHEQUEO_POR_DEFECTO } from '../../models/OrdenChequeo';
import { errores } from '../../shared/http/http-error';
import { exigirTipoDelTaller } from '../configuracion/tipos-equipo.service';
import { cifrarCredenciales } from '../equipos/equipos.service';
import { generarNumeroSerieUnico } from '../equipos/numero-serie';
import { esEstadoFinal, esTransicionValida, etiquetaEstado, transicionesDesde } from './estado-orden';
import { generarNumeroOrden } from './numero-orden';
import { monedaDePais, PAIS_POR_DEFECTO } from '../../shared/utils/paises';
import { generarCodigoSeguimiento } from '../seguimiento/codigo';
import {
  actualizarOrdenSchema,
  cambiarEstadoSchema,
  ChequeoInput,
  crearOrdenSchema,
  listarOrdenesQuery,
  presupuestoSchema
} from './ordenes.schemas';
import { saldoDeCliente } from '../cuentas/cuenta-corriente.service';
import { notificarCambioEstadoOrden, ResultadoNotificacion } from '../notificaciones/notificaciones.service';
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
  // Sin moneda elegida, la del país del taller.
  const taller = await Taller.findByPk(ctx.tallerId, { attributes: ['pais'] });
  const monedaPorDefecto = monedaDePais(taller?.pais ?? PAIS_POR_DEFECTO);

  const ordenId = await sequelize.transaction(async (transaction) => {
    const clienteId = await resolverCliente(data, ctx, transaction);
    const equipoId = await resolverEquipo(data, clienteId, ctx, transaction);

    const orden = await Orden.create(
      {
        tallerId: ctx.tallerId,
        numeroOrden: await generarNumeroOrden(transaction, ctx.tallerId),
        codigoSeguimiento: generarCodigoSeguimiento(),
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
        moneda: data.moneda ?? monedaPorDefecto
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

// ---------------------------------------------------------------------------
// Consultas y cambios de una orden
// ---------------------------------------------------------------------------

const LIMITE_LISTADO = 200;

/** Para cambios que avisan al cliente: la orden viene con su cliente. */
export const CON_CLIENTE = { include: [{ model: Cliente, as: 'cliente' }] };

export function listarOrdenes(
  sucursalId: number,
  filtros: z.infer<typeof listarOrdenesQuery>
): Promise<Orden[]> {
  return Orden.findAll({
    where: filtroDeOrdenes(sucursalId, filtros),
    include: INCLUDES_LISTADO,
    order: [['createdAt', 'DESC']],
    limit: LIMITE_LISTADO
  });
}

/** Saldo del cliente en la moneda de la orden: es el único que la entrega puede usar. */
export const saldoEnMonedaDe = (orden: Orden) =>
  saldoDeCliente(orden.tallerId, orden.clienteId, orden.moneda);

/** Va con el saldo del cliente, para que la entrega pueda ofrecer aplicar el saldo a favor. */
export async function conSaldoCliente(orden: Orden) {
  return { ...orden.get({ plain: true }), saldoCliente: await saldoEnMonedaDe(orden) };
}

export function actualizarOrden(orden: Orden, data: z.infer<typeof actualizarOrdenSchema>): Promise<Orden> {
  return orden.update(data);
}

/** Avisa al cliente si cambió el estado. El aviso nunca revierte el cambio. */
async function avisarSiCambio(orden: Orden, estadoAnterior: string): Promise<ResultadoNotificacion | null> {
  if (orden.estado === estadoAnterior || !orden.cliente) return null;
  return notificarCambioEstadoOrden(orden, orden.cliente);
}

/** Cambio de estado manual. La orden tiene que venir con su cliente (`CON_CLIENTE`) para avisarle. */
export async function cambiarEstado(
  orden: Orden,
  { estado: nuevoEstado, comentario, notaInterna, forzar }: z.infer<typeof cambiarEstadoSchema>,
  quien: { usuarioId: number; esAdmin: boolean }
) {
  const estadoAnterior = orden.estado;

  // La entrega mueve plata y tiene su propio endpoint: por acá el equipo
  // saldría entregado sin registrar cuánto se cobró.
  if (nuevoEstado === 'entregado') {
    throw errores.conflicto('Para entregar el equipo hay que registrar el cobro desde la entrega.');
  }
  if (nuevoEstado === estadoAnterior) {
    throw errores.solicitudInvalida(`La orden ya está en estado "${etiquetaEstado(estadoAnterior)}"`);
  }

  const forzado = !esTransicionValida(estadoAnterior, nuevoEstado);
  if (forzado) {
    // El admin puede salirse del circuito cuando la realidad no entra en el
    // diagrama, pero tiene que dejar asentado por qué.
    if (!(forzar && quien.esAdmin)) {
      const posibles = transicionesDesde(estadoAnterior).map(etiquetaEstado);
      throw errores.conflicto(
        posibles.length > 0
          ? `No se puede pasar de "${etiquetaEstado(estadoAnterior)}" a "${etiquetaEstado(nuevoEstado)}". Estados posibles: ${posibles.join(', ')}.`
          : `La orden está en "${etiquetaEstado(estadoAnterior)}" y no admite más cambios de estado.`
      );
    }
    if (!comentario) {
      throw errores.solicitudInvalida(
        'Para forzar un cambio de estado fuera del circuito hay que indicar el motivo'
      );
    }
  }

  await sequelize.transaction(async (transaction) => {
    await orden.update({ estado: nuevoEstado }, { transaction });
    await registrarCambioDeEstado(
      {
        ordenId: orden.id,
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        usuarioId: quien.usuarioId,
        comentario: forzado ? `[Forzado] ${comentario}` : comentario,
        notaInterna
      },
      transaction
    );
  });

  return { ...orden.get({ plain: true }), notificacion: await avisarSiCambio(orden, estadoAnterior) };
}

/**
 * Carga el monto del presupuesto y/o la respuesta del cliente.
 *
 * Cargar el monto es, en la práctica, presupuestar: si el circuito lo permite
 * la orden avanza sola a "presupuestado", así el mostrador no lo hace aparte.
 *
 * La moneda se elige junto con el monto. Una vez entregada la orden no se
 * cambia: lo cobrado ya quedó asentado en la cuenta en esa moneda.
 */
export async function actualizarPresupuesto(
  orden: Orden,
  { monto, moneda, aprobado }: z.infer<typeof presupuestoSchema>,
  usuarioId: number
) {
  const estadoAnterior = orden.estado;

  const cambios: Partial<Pick<Orden, 'presupuestoMonto' | 'presupuestoAprobado' | 'estado' | 'moneda'>> = {};

  if (moneda !== undefined && moneda !== orden.moneda) {
    if (orden.montoTotal != null) {
      throw errores.conflicto(
        `La orden ya se cobró en ${orden.moneda}: la moneda no se puede cambiar después de la entrega.`
      );
    }
    cambios.moneda = moneda;
  }

  if (monto !== undefined) {
    cambios.presupuestoMonto = monto;
    if (monto !== null && esTransicionValida(estadoAnterior, 'presupuestado'))
      cambios.estado = 'presupuestado';
  }

  if (aprobado !== undefined && aprobado !== null) {
    const destino = aprobado ? 'aprobado' : 'rechazado';
    const estadoBase = cambios.estado ?? estadoAnterior;
    if (!esTransicionValida(estadoBase, destino)) {
      throw errores.conflicto(
        `Para registrar la respuesta del cliente, la orden tiene que estar presupuestada (hoy está en "${etiquetaEstado(estadoBase)}").`
      );
    }
    cambios.presupuestoAprobado = aprobado;
    cambios.estado = destino;
  }

  await sequelize.transaction(async (transaction) => {
    await orden.update(cambios, { transaction });
    if (orden.estado !== estadoAnterior) {
      await registrarCambioDeEstado(
        {
          ordenId: orden.id,
          estadoAnterior,
          estadoNuevo: orden.estado,
          usuarioId,
          comentario: 'Actualización de presupuesto'
        },
        transaction
      );
    }
  });

  return { ...orden.get({ plain: true }), notificacion: await avisarSiCambio(orden, estadoAnterior) };
}

export async function reemplazarChequeos(orden: Orden, chequeos: ChequeoInput[]): Promise<OrdenChequeo[]> {
  await sequelize.transaction(async (transaction) => {
    await OrdenChequeo.destroy({ where: { ordenId: orden.id }, transaction });
    await OrdenChequeo.bulkCreate(filasDeChequeo(orden.id, chequeos), { transaction });
  });

  return OrdenChequeo.findAll({ where: { ordenId: orden.id }, order: [['orden', 'ASC']] });
}
