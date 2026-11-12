import { Op, Transaction } from 'sequelize';
import {
  sequelize,
  ChequeoPersonalizado,
  Cliente,
  Equipo,
  Orden,
  OrdenChequeo,
  OrdenHistorialEstado,
  Sucursal,
  Taller,
  Tercerizacion,
  TipoEquipoPersonalizado,
  User,
  UsuarioSucursal
} from '../../models';
import type { EstadoOrden } from '../../models/Orden';
import { OPCIONES_CHEQUEO_POR_DEFECTO } from '../../models/OrdenChequeo';
import { TERCERIZACION_ACTIVA } from '../../models/Tercerizacion';
import { getEmailProvider } from '../../integrations/email';
import { errores } from '../../shared/http/http-error';
import { monedaDePais, PAIS_POR_DEFECTO } from '../../shared/utils/paises';
import { escaparHtml } from '../../shared/utils/texto';
import { generarNumeroSerieUnico } from '../equipos/numero-serie';
import { notificarEnLaApp } from '../notificaciones/notificaciones.service';
import { generarCodigoSeguimiento } from '../seguimiento/codigo';
import { esTransicionValida, etiquetaEstado } from './estado-orden';
import { generarNumeroOrden } from './numero-orden';
import type { TercerizarInput } from './ordenes.schemas';

/**
 * Tercerización: el taller manda un equipo a reparar afuera.
 *
 * La orden pasa a "externo" y queda anotado a quién se mandó. Si el destino es
 * un taller que también usa RepairOS, se le arma una orden "por recibir" con el
 * equipo y el trabajo pedido, y se le avisa: cuando le llega, solo confirma que
 * lo recibió. Para ese taller el cliente es el taller que se lo manda; los datos
 * del cliente final nunca salen del taller de origen.
 *
 * El cliente final no se entera: ve "En reparación" (`estadoParaCliente`).
 */

const USUARIO_RESUMIDO = ['id', 'nombre', 'apellido'];

/** Lo que se hace después de confirmar la transacción: los avisos no la pueden tumbar. */
type Despues = () => Promise<void>;

export const soloDigitos = (valor: string) => valor.replace(/\D/g, '');

/**
 * Cómo buscar un taller por el documento que se tipeó.
 *
 * Con 11 dígitos es un CUIT y se compara entero. Con 7 u 8 es un DNI: el CUIT
 * de una persona es el prefijo, el DNI con 8 dígitos y el verificador, así que
 * se busca en el medio (`__30123456_`).
 */
export function patronDeCuit(documento: string): string | { [Op.like]: string } | null {
  const digitos = soloDigitos(documento);
  if (digitos.length === 11) return digitos;
  if (digitos.length === 7 || digitos.length === 8) return { [Op.like]: `__${digitos.padStart(8, '0')}_` };
  return null;
}

/** El taller de RepairOS con ese DNI o CUIT, con sus sucursales activas. Nunca el propio. */
async function tallerDeRepairOS(documento: string, tallerPropioId: number) {
  const cuit = patronDeCuit(documento);
  if (!cuit) return null;
  return Taller.findOne({
    where: { cuit, activo: true, id: { [Op.ne]: tallerPropioId } },
    attributes: ['id', 'nombre', 'razonSocial', 'cuit', 'domicilioFiscal', 'pais'],
    include: [
      {
        model: Sucursal,
        as: 'sucursales',
        where: { activo: true },
        attributes: ['id', 'nombre', 'direccion', 'telefono']
      }
    ],
    order: [[{ model: Sucursal, as: 'sucursales' }, 'id', 'ASC']]
  });
}

/**
 * Autocompletar el destino a partir del DNI o CUIT.
 *
 * - `taller`: si es un taller de RepairOS. Sale lo mismo que imprime en sus
 *   remitos (nombre, dirección y teléfono de sus sucursales); el email de sus
 *   usuarios no, porque el aviso le llega por RepairOS.
 * - `anterior`: los datos con que este taller le mandó un equipo la última vez,
 *   para no volver a tipear a un técnico de afuera.
 */
export async function buscarDestino(tallerId: number, documento: string) {
  const digitos = soloDigitos(documento);
  const [taller, anterior] = await Promise.all([
    tallerDeRepairOS(digitos, tallerId),
    digitos.length >= 7
      ? Tercerizacion.findOne({
          where: { tallerId, dniCuit: digitos },
          attributes: ['nombre', 'dniCuit', 'direccion', 'telefono', 'email'],
          order: [['createdAt', 'DESC']]
        })
      : null
  ]);

  return {
    taller: taller
      ? {
          id: taller.id,
          nombre: taller.nombre,
          razonSocial: taller.razonSocial,
          cuit: taller.cuit,
          sucursales: (taller.get('sucursales') as Sucursal[]).map((s) => ({
            id: s.id,
            nombre: s.nombre,
            direccion: s.direccion ?? taller.domicilioFiscal,
            telefono: s.telefono
          }))
        }
      : null,
    anterior: anterior?.get({ plain: true }) ?? null
  };
}

/** Admins del taller y usuarios con permiso en la sucursal: los que ven sus órdenes. */
async function usuariosDeSucursal(tallerId: number, sucursalId: number): Promise<User[]> {
  const conPermiso = await UsuarioSucursal.findAll({ where: { sucursalId }, attributes: ['usuarioId'] });
  return User.findAll({
    where: {
      tallerId,
      activo: true,
      [Op.or]: [{ rol: 'admin' }, { id: conPermiso.map((p) => p.usuarioId) }]
    },
    attributes: ['id', 'email', 'rol']
  });
}

async function avisarASucursal(
  tallerId: number,
  sucursalId: number,
  aviso: { titulo: string; mensaje: string; link: string },
  email?: { asunto: string; parrafos: string[] }
): Promise<void> {
  const usuarios = await usuariosDeSucursal(tallerId, sucursalId);
  await notificarEnLaApp(
    usuarios.map((u) => u.id),
    { tipo: 'tercerizacion', ...aviso }
  );

  const proveedor = getEmailProvider();
  if (!email || !proveedor.estaConfigurado()) return;
  const html = email.parrafos.map((p) => `<p>${escaparHtml(p)}</p>`).join('');
  // Por email, solo a los admins: los técnicos lo ven en la campanita.
  await Promise.allSettled(
    usuarios
      .filter((u) => u.rol === 'admin')
      .map((u) => proveedor.send({ to: u.email, subject: email.asunto, html }))
  );
}

/**
 * El cliente del taller destino es el taller de origen, cargado como cliente
 * de gremio. Se reusa el de un envío anterior o el que tenga su CUIT.
 */
async function clienteEnDestino(
  origen: Taller,
  sucursalOrigen: Sucursal | null,
  tallerDestinoId: number,
  transaction: Transaction
): Promise<number> {
  const previa = await Tercerizacion.findOne({
    where: { tallerId: origen.id, tallerDestinoId, ordenDestinoId: { [Op.ne]: null } },
    include: [{ model: Orden, as: 'ordenDestino', attributes: ['clienteId'] }],
    order: [['createdAt', 'DESC']],
    transaction
  });
  if (previa?.ordenDestino) {
    const existe = await Cliente.count({
      where: { id: previa.ordenDestino.clienteId, tallerId: tallerDestinoId, anonimizadoEn: null },
      transaction
    });
    if (existe) return previa.ordenDestino.clienteId;
  }

  if (origen.cuit) {
    const porCuit = await Cliente.findOne({
      where: { tallerId: tallerDestinoId, dniCuit: origen.cuit, anonimizadoEn: null },
      attributes: ['id'],
      transaction
    });
    if (porCuit) return porCuit.id;
  }

  const nuevo = await Cliente.create(
    {
      tallerId: tallerDestinoId,
      nombre: (origen.razonSocial ?? origen.nombre).slice(0, 100),
      apellido: '',
      dniCuit: origen.cuit,
      telefono: sucursalOrigen?.telefono ?? null,
      direccion: sucursalOrigen?.direccion ?? origen.domicilioFiscal,
      esGremio: true,
      nombreGremio: origen.nombre
    },
    { transaction }
  );
  return nuevo.id;
}

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

/**
 * Un tipo de equipo que el destino ya tenga, para poder armar la orden: el de
 * igual nombre ("Celular" y "celular" son el mismo) o, si no, el primero de la
 * sucursal. No se le crean tipos: cada taller los nombra a su manera ("iPhone"
 * acá, "Celular" allá) y terminaría lleno de tipos que no usa. Al recibir el
 * equipo, el destino elige el suyo (ver `recibirEquipo`).
 *
 * Solo si la sucursal no tiene ninguno (no podría tomar órdenes) se crea uno.
 */
async function tipoEnDestino(nombre: string, sucursalId: number, transaction: Transaction) {
  const tipos = await TipoEquipoPersonalizado.findAll({
    where: { sucursalId, activo: true },
    attributes: ['id', 'nombre'],
    order: [['id', 'ASC']],
    transaction
  });
  const buscado = normalizar(nombre);
  const elegido = tipos.find((t) => normalizar(t.nombre) === buscado) ?? tipos[0];
  if (elegido) return elegido.id;

  const [creado] = await TipoEquipoPersonalizado.findOrCreate({
    where: { sucursalId, nombre },
    defaults: { sucursalId, nombre, usuarioId: null },
    transaction
  });
  return creado.id;
}

/**
 * Copia del equipo para el taller destino. Si ya tiene uno con ese número de
 * serie del mismo cliente (el mismo equipo, mandado otra vez), lo reusa; si es
 * de otro cliente, no lo toca y le da un número nuevo.
 *
 */
async function equipoEnDestino(
  equipo: Equipo,
  destino: { tallerId: number; sucursalId: number; clienteId: number },
  compartirClaves: boolean,
  transaction: Transaction
): Promise<number> {
  const tipoId = await tipoEnDestino(equipo.tipoEquipo?.nombre ?? 'Otro', destino.sucursalId, transaction);
  const claves = compartirClaves
    ? {
        claveDesbloqueoEnc: equipo.claveDesbloqueoEnc,
        cuentaUsuarioEnc: equipo.cuentaUsuarioEnc,
        cuentaPasswordEnc: equipo.cuentaPasswordEnc
      }
    : {};

  const mismo = await Equipo.findOne({
    where: { tallerId: destino.tallerId, numeroSerie: equipo.numeroSerie },
    transaction
  });
  if (mismo?.clienteId === destino.clienteId) {
    await mismo.update(claves, { transaction });
    return mismo.id;
  }

  const nuevo = await Equipo.create(
    {
      tallerId: destino.tallerId,
      clienteId: destino.clienteId,
      tipoEquipoPersonalizadoId: tipoId,
      marca: equipo.marca,
      modelo: equipo.modelo,
      color: equipo.color,
      numeroSerie: mismo ? await generarNumeroSerieUnico(destino.tallerId) : equipo.numeroSerie,
      ...claves
    },
    { transaction }
  );
  return nuevo.id;
}

/**
 * El chequeo de recepción de la orden del destino sale de SU checklist para el
 * tipo de equipo que eligió al recibirlo, sin responder: cada taller revisa con
 * su propio criterio qué funciona y qué no, aunque el que lo manda ya lo haya
 * revisado. Por lo mismo tampoco se copia el estado estético.
 */
async function chequeosDelDestino(ordenId: number, tipoId: number, transaction: Transaction) {
  const plantilla = await ChequeoPersonalizado.findAll({
    where: { tipoEquipoPersonalizadoId: tipoId },
    order: [
      ['orden', 'ASC'],
      ['id', 'ASC']
    ],
    transaction
  });
  await OrdenChequeo.bulkCreate(
    plantilla.map((c, indice) => ({
      ordenId,
      item: c.texto,
      resultado: null,
      opciones: c.opciones?.length ? c.opciones : OPCIONES_CHEQUEO_POR_DEFECTO,
      orden: indice
    })),
    { transaction }
  );
}

/** Quién figura como técnico de la orden hasta que alguien del destino la recibe. */
async function responsableEnDestino(tallerId: number, transaction: Transaction): Promise<number> {
  const usuario = await User.findOne({
    where: { tallerId, activo: true },
    attributes: ['id'],
    order: [
      ['rol', 'ASC'], // 'admin' antes que 'tecnico'
      ['id', 'ASC']
    ],
    transaction
  });
  if (!usuario)
    throw errores.conflicto('El taller destino no tiene usuarios activos para recibir el equipo.');
  return usuario.id;
}

/**
 * Manda el equipo afuera. La orden tiene que venir con su equipo (y el tipo).
 *
 * Valida que el taller de RepairOS elegido sea el del DNI o CUIT cargado: no
 * alcanza con conocer su id para mandarle órdenes a un taller cualquiera.
 */
export async function tercerizarOrden(
  orden: Orden,
  datos: TercerizarInput,
  usuarioId: number
): Promise<{ orden: Orden; estadoAnterior: EstadoOrden }> {
  const estadoAnterior = orden.estado;
  if (!esTransicionValida(estadoAnterior, 'externo')) {
    throw errores.conflicto(
      `Desde "${etiquetaEstado(estadoAnterior)}" no se puede mandar el equipo a un taller externo.`
    );
  }
  const activo = await envioActivo(orden.id);
  if (activo) {
    throw errores.conflicto(
      `El equipo ya está en ${activo.nombre}: para seguir allá, elegí "Externo" en el cambio de estado.`
    );
  }

  let destino: { taller: Taller; sucursal: Sucursal } | null = null;
  if (datos.tallerDestinoId) {
    const taller = datos.dniCuit ? await tallerDeRepairOS(datos.dniCuit, orden.tallerId) : null;
    if (!taller || taller.id !== datos.tallerDestinoId) {
      throw errores.solicitudInvalida('El DNI o CUIT no corresponde al taller de RepairOS elegido.');
    }
    const sucursales = taller.get('sucursales') as Sucursal[];
    const sucursal = datos.sucursalDestinoId
      ? sucursales.find((s) => s.id === datos.sucursalDestinoId)
      : sucursales[0];
    if (!sucursal) throw errores.noEncontrado('Sucursal del taller destino');
    destino = { taller, sucursal };
  }

  const [origen, sucursalOrigen, equipo] = await Promise.all([
    Taller.findByPk(orden.tallerId),
    Sucursal.findByPk(orden.sucursalId),
    Equipo.findByPk(orden.equipoId, {
      include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['nombre'] }]
    })
  ]);
  if (!origen || !equipo) throw errores.noEncontrado('Orden');

  const ordenDestino = await sequelize.transaction(async (transaction) => {
    let creada: Orden | null = null;
    if (destino) {
      const clienteId = await clienteEnDestino(origen, sucursalOrigen, destino.taller.id, transaction);
      const equipoId = await equipoEnDestino(
        equipo,
        { tallerId: destino.taller.id, sucursalId: destino.sucursal.id, clienteId },
        Boolean(datos.compartirClaves),
        transaction
      );
      creada = await Orden.create(
        {
          tallerId: destino.taller.id,
          numeroOrden: await generarNumeroOrden(transaction, destino.taller.id),
          codigoSeguimiento: generarCodigoSeguimiento(),
          clienteId,
          equipoId,
          sucursalId: destino.sucursal.id,
          tecnicoId: await responsableEnDestino(destino.taller.id, transaction),
          estado: 'por_recibir',
          reparacionSolicitada: datos.trabajo,
          moneda: monedaDePais(destino.taller.pais ?? PAIS_POR_DEFECTO)
        },
        { transaction }
      );
      await OrdenHistorialEstado.create(
        {
          ordenId: creada.id,
          estadoAnterior: null,
          estadoNuevo: 'por_recibir',
          usuarioId,
          comentario: `Enviada por ${origen.nombre} (su orden ${orden.numeroOrden})`
        },
        { transaction }
      );
    }

    await Tercerizacion.create(
      {
        tallerId: orden.tallerId,
        ordenId: orden.id,
        nombre: datos.nombre,
        dniCuit: datos.dniCuit,
        direccion: datos.direccion,
        telefono: datos.telefono,
        email: datos.email,
        trabajo: datos.trabajo,
        tallerDestinoId: destino?.taller.id ?? null,
        ordenDestinoId: creada?.id ?? null,
        enviadaPorId: usuarioId
      },
      { transaction }
    );

    await orden.update({ estado: 'externo' }, { transaction });
    // Sin comentario: el comentario sale en el remito y el seguimiento, y el
    // cliente no tiene que enterarse de que el equipo se mandó afuera.
    await OrdenHistorialEstado.create(
      {
        ordenId: orden.id,
        estadoAnterior,
        estadoNuevo: 'externo',
        usuarioId,
        comentario: null,
        notaInterna: [`Enviado a ${datos.nombre}.`, datos.notaInterna].filter(Boolean).join(' ')
      },
      { transaction }
    );
    return creada;
  });

  if (destino && ordenDestino) {
    const que = [equipo.marca, equipo.modelo].filter(Boolean).join(' ') || 'un equipo';
    await avisarASucursal(
      destino.taller.id,
      destino.sucursal.id,
      {
        titulo: `${origen.nombre} te manda ${que}`,
        mensaje: `Se armó la orden ${ordenDestino.numeroOrden} en ${destino.sucursal.nombre}. Cuando llegue el equipo, marcalo como recibido. Trabajo: ${datos.trabajo}`,
        link: `/ordenes/${ordenDestino.id}`
      },
      {
        asunto: `${origen.nombre} te manda ${que} para reparar`,
        parrafos: [
          `${origen.nombre} te tercerizó la reparación de ${que} (su orden ${orden.numeroOrden}).`,
          `Trabajo pedido: ${datos.trabajo}`,
          `Ya tenés la orden ${ordenDestino.numeroOrden} armada en la sucursal ${destino.sucursal.nombre}: cuando llegue el equipo, entrá a RepairOS y marcalo como recibido.`
        ]
      }
    ).catch((err) => console.error('[tercerizacion] aviso al destino:', err));
  }

  return { orden, estadoAnterior };
}

/**
 * Estados que dicen que el equipo volvió al taller: se sigue reparando acá, ya
 * está para retirar o la orden se cerró. Pasar a "presupuestado" o "en espera"
 * no: el externo puede haber cotizado y el equipo sigue allá mientras el
 * cliente decide.
 */
const ESTADOS_DE_VUELTA: readonly EstadoOrden[] = [
  'en_reparacion',
  'listo_para_retirar',
  'no_reparado',
  'entregado',
  'cancelado'
];

/** El envío en curso de la orden, si el equipo está afuera. */
export function envioActivo(ordenId: number, transaction?: Transaction) {
  return Tercerizacion.findOne({
    where: { ordenId, estado: [...TERCERIZACION_ACTIVA] },
    include: [{ model: Orden, as: 'ordenDestino' }],
    order: [['createdAt', 'DESC']],
    transaction
  });
}

/**
 * Mantiene la tercerización al día cuando cambia el estado de una orden. Se
 * llama dentro de la transacción del cambio y devuelve los avisos a mandar
 * después de confirmarla.
 *
 * - Orden del destino que sale de "por recibir": llegó el equipo (o el taller
 *   lo rechaza) y se le avisa al taller de origen.
 * - Orden de origen que pasa a un estado de vuelta: el equipo volvió. Si el
 *   destino de RepairOS todavía no lo había recibido, el envío se cancela y su
 *   orden "por recibir" también.
 */
export async function sincronizarTercerizacion(
  orden: Orden,
  estadoAnterior: EstadoOrden,
  usuarioId: number,
  transaction: Transaction
): Promise<Despues | null> {
  if (estadoAnterior === 'por_recibir') return respuestaDelDestino(orden, usuarioId, transaction);
  if (ESTADOS_DE_VUELTA.includes(orden.estado)) return volvioDelExterno(orden, usuarioId, transaction);
  return null;
}

async function volvioDelExterno(orden: Orden, usuarioId: number, transaction: Transaction) {
  const envio = await envioActivo(orden.id, transaction);
  if (!envio) return null;

  const destino = envio.ordenDestino;
  const sinLlegar = destino?.estado === 'por_recibir';
  const ahora = new Date();
  await envio.update(
    sinLlegar ? { estado: 'cancelada', canceladaEn: ahora } : { estado: 'devuelta', devueltaEn: ahora },
    { transaction }
  );
  if (!destino || !sinLlegar) return null;

  const origen = await Taller.findByPk(orden.tallerId, { attributes: ['nombre'], transaction });
  await destino.update({ estado: 'cancelado' }, { transaction });
  await OrdenHistorialEstado.create(
    {
      ordenId: destino.id,
      estadoAnterior: 'por_recibir',
      estadoNuevo: 'cancelado',
      usuarioId,
      comentario: `${origen?.nombre ?? 'El taller'} canceló el envío`
    },
    { transaction }
  );
  return () =>
    avisarASucursal(destino.tallerId, destino.sucursalId, {
      titulo: `${origen?.nombre ?? 'El taller'} canceló un envío`,
      mensaje: `La orden ${destino.numeroOrden} quedó cancelada: el equipo no te lo van a mandar.`,
      link: `/ordenes/${destino.id}`
    });
}

async function respuestaDelDestino(orden: Orden, usuarioId: number, transaction: Transaction) {
  const envio = await Tercerizacion.findOne({
    where: { ordenDestinoId: orden.id },
    include: [{ model: Orden, as: 'orden', attributes: ['id', 'numeroOrden', 'tallerId', 'sucursalId'] }],
    transaction
  });
  const destino = await Taller.findByPk(orden.tallerId, { attributes: ['nombre'], transaction });
  const nombre = destino?.nombre ?? 'El taller';

  const rechazada = orden.estado === 'cancelado';
  if (!rechazada) {
    // Quien lo recibe pasa a ser el técnico, y la fecha de ingreso es la de llegada.
    await orden.update({ tecnicoId: usuarioId, fechaIngreso: new Date() }, { transaction });
    const equipo = await Equipo.findByPk(orden.equipoId, {
      attributes: ['tipoEquipoPersonalizadoId'],
      transaction
    });
    const yaTiene = await OrdenChequeo.count({ where: { ordenId: orden.id }, transaction });
    if (equipo && !yaTiene) await chequeosDelDestino(orden.id, equipo.tipoEquipoPersonalizadoId, transaction);
  }
  if (!envio?.orden || !TERCERIZACION_ACTIVA.includes(envio.estado)) return null;
  await envio.update(
    rechazada
      ? { estado: 'cancelada', canceladaEn: new Date() }
      : { estado: 'recibida', recibidaEn: new Date() },
    { transaction }
  );

  const origen = envio.orden;
  return () =>
    avisarASucursal(origen.tallerId, origen.sucursalId, {
      titulo: rechazada
        ? `${nombre} no va a recibir el equipo de la orden ${origen.numeroOrden}`
        : `${nombre} recibió el equipo de la orden ${origen.numeroOrden}`,
      mensaje: rechazada
        ? 'Canceló la orden que se le había armado. El equipo sigue figurando como externo: cambiale el estado.'
        : 'Ya está en su taller. Vas a ver cómo avanza en la orden.',
      link: `/ordenes/${origen.id}`
    });
}

/**
 * Lo que muestra el detalle de la orden sobre la tercerización: a quién se
 * mandó (y en qué anda la orden del destino, si usa RepairOS) y, en la orden
 * del destino, quién se la mandó.
 *
 * Del otro taller no sale nada más que su nombre, el número y estado de la
 * orden, y el link de seguimiento que ya ve cualquiera que lo tenga.
 */
export async function tercerizacionDeOrden(orden: Orden) {
  const [enviadas, recibida] = await Promise.all([
    Tercerizacion.findAll({
      where: { ordenId: orden.id },
      include: [
        {
          model: Orden,
          as: 'ordenDestino',
          attributes: ['numeroOrden', 'estado', 'codigoSeguimiento']
        },
        { model: User, as: 'enviadaPor', attributes: USUARIO_RESUMIDO }
      ],
      order: [['createdAt', 'DESC']]
    }),
    Tercerizacion.findOne({
      where: { ordenDestinoId: orden.id },
      attributes: ['trabajo', 'createdAt'],
      include: [
        { model: Taller, as: 'taller', attributes: ['nombre'] },
        { model: Orden, as: 'orden', attributes: ['numeroOrden'] }
      ]
    })
  ]);

  return {
    tercerizaciones: enviadas.map((t) => ({
      id: t.id,
      estado: t.estado,
      nombre: t.nombre,
      dniCuit: t.dniCuit,
      direccion: t.direccion,
      telefono: t.telefono,
      email: t.email,
      trabajo: t.trabajo,
      enRepairOS: t.tallerDestinoId != null,
      ordenDestino: t.ordenDestino
        ? {
            numeroOrden: t.ordenDestino.numeroOrden,
            estado: t.ordenDestino.estado,
            etiquetaEstado: etiquetaEstado(t.ordenDestino.estado),
            codigoSeguimiento: t.ordenDestino.codigoSeguimiento
          }
        : null,
      enviadaPor: t.enviadaPor ?? null,
      createdAt: t.createdAt,
      recibidaEn: t.recibidaEn,
      devueltaEn: t.devueltaEn,
      canceladaEn: t.canceladaEn
    })),
    tercerizacionRecibida: recibida
      ? {
          taller: recibida.taller?.nombre ?? null,
          numeroOrden: recibida.orden?.numeroOrden ?? null,
          trabajo: recibida.trabajo,
          createdAt: recibida.createdAt
        }
      : null
  };
}

/**
 * "Recibí el equipo": el destino elige el tipo de equipo entre los suyos (con
 * ese tipo se carga su checklist) y la orden pasa a "Recibido". El cambio de
 * estado lo hace quien llama, para que avise como cualquier otro.
 */
export async function elegirTipoAlRecibir(orden: Orden, tipoEquipoPersonalizadoId: number) {
  if (orden.estado !== 'por_recibir') {
    throw errores.conflicto('Este equipo ya se recibió.');
  }
  const tipo = await TipoEquipoPersonalizado.findOne({
    where: { id: tipoEquipoPersonalizadoId, sucursalId: orden.sucursalId },
    attributes: ['id']
  });
  if (!tipo) throw errores.noEncontrado('Tipo de equipo');
  await Equipo.update(
    { tipoEquipoPersonalizadoId: tipo.id },
    { where: { id: orden.equipoId, tallerId: orden.tallerId } }
  );
}
