import { Op } from 'sequelize';
import {
  sequelize,
  Cliente,
  CuentaMovimiento,
  Equipo,
  Orden,
  Taller,
  TipoEquipoPersonalizado
} from '../../models';
import { errores } from '../../shared/http/http-error';
import { generarCodigoPublico } from '../seguimiento/codigo';
import { saldosDeClientes } from '../cuentas/cuenta-corriente.service';
import { etiquetaEstado } from '../ordenes/estado-orden';

const LIMITE_ORDENES = 50;
const LIMITE_MOVIMIENTOS = 50;

/** El código público del taller; si todavía no tiene (talleres viejos o de scripts), se crea. */
export async function codigoPublicoDe(taller: Taller): Promise<string> {
  if (!taller.codigoPublico) await taller.update({ codigoPublico: generarCodigoPublico() });
  return taller.codigoPublico!;
}

const soloDigitos = (texto: string) => texto.replace(/\D/g, '');

/** Expresión SQL de una columna sin puntos, guiones ni espacios: "30-71.044 562" → "3071044562". */
const sinSeparadores = (columna: string) =>
  sequelize.fn(
    'REPLACE',
    sequelize.fn('REPLACE', sequelize.fn('REPLACE', sequelize.col(columna), '-', ''), '.', ''),
    ' ',
    ''
  );

/** No revela si el DNI existe o si lo que no coincidió fue el teléfono. */
const sinCoincidencia = () => errores.noEncontrado('No encontramos datos con ese DNI y teléfono. Cliente');

/**
 * Lo que ve un cliente del taller en el portal, con su DNI y los últimos 4
 * dígitos de su teléfono.
 *
 * El teléfono es el segundo dato a propósito: el DNI solo no alcanza, porque
 * se consigue fácil y es casi correlativo. Si el mismo DNI está cargado más de
 * una vez (clientes duplicados), se juntan las órdenes y los saldos de todos.
 *
 * Nunca sale lo interno del taller: notas internas, credenciales, ni las notas
 * de los movimientos (pueden tener el motivo de un ajuste).
 */
export async function consultarPortal(codigoTaller: string, dni: string, ultimosTelefono: string) {
  const taller = await Taller.findOne({ where: { codigoPublico: codigoTaller.toUpperCase(), activo: true } });
  if (!taller) throw errores.noEncontrado('Taller');

  const candidatos = await Cliente.findAll({
    where: {
      tallerId: taller.id,
      anonimizadoEn: null,
      telefono: { [Op.ne]: null },
      [Op.and]: [sequelize.where(sinSeparadores('dni_cuit'), soloDigitos(dni))]
    },
    order: [['updatedAt', 'DESC']]
  });
  const clientes = candidatos.filter((c) => soloDigitos(c.telefono ?? '').endsWith(ultimosTelefono));
  if (clientes.length === 0) throw sinCoincidencia();

  const ids = clientes.map((c) => c.id);
  const [ordenes, movimientos, saldos] = await Promise.all([
    Orden.findAll({
      where: { clienteId: ids },
      include: [
        {
          model: Equipo,
          as: 'equipo',
          attributes: ['marca', 'modelo'],
          include: [{ model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['nombre'] }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: LIMITE_ORDENES
    }),
    CuentaMovimiento.findAll({
      where: { clienteId: ids },
      include: [{ model: Orden, as: 'orden', attributes: ['numeroOrden'] }],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ],
      limit: LIMITE_MOVIMIENTOS
    }),
    saldosDeClientes(taller.id, ids)
  ]);

  // Saldos de todos los registros del mismo cliente, sumados por moneda.
  const porMoneda = new Map<string, number>();
  for (const lista of saldos.values()) {
    for (const { moneda, saldo } of lista) porMoneda.set(moneda, (porMoneda.get(moneda) ?? 0) + saldo);
  }

  const cliente = clientes[0];
  return {
    taller: taller.nombre,
    cliente: {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      dniCuit: cliente.dniCuit,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      ciudad: cliente.ciudad
    },
    saldos: [...porMoneda]
      .filter(([, saldo]) => Math.abs(saldo) >= 0.01)
      .map(([moneda, saldo]) => ({ moneda, saldo: Math.round(saldo * 100) / 100 })),
    ordenes: ordenes.map((o) => ({
      numeroOrden: o.numeroOrden,
      estado: o.estado,
      etiquetaEstado: etiquetaEstado(o.estado),
      fechaIngreso: o.fechaIngreso,
      fechaEntrega: o.fechaEntrega,
      equipo: [o.equipo?.tipoEquipo?.nombre, o.equipo?.marca, o.equipo?.modelo].filter(Boolean).join(' · '),
      presupuestoMonto: o.presupuestoMonto,
      montoTotal: o.montoTotal,
      moneda: o.moneda,
      codigoSeguimiento: o.codigoSeguimiento
    })),
    movimientos: movimientos.map((m) => ({
      fecha: m.createdAt,
      tipo: m.tipo,
      monto: m.monto,
      moneda: m.moneda,
      medioPago: m.medioPago,
      numeroOrden:
        (m as CuentaMovimiento & { orden?: { numeroOrden: string } | null }).orden?.numeroOrden ?? null
    }))
  };
}
