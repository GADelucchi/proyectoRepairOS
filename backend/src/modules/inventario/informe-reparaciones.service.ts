import { Op } from 'sequelize';
import { Cliente, Equipo, Orden } from '../../models';
import { aNumero, redondearMonto } from '../../shared/utils/dinero';
import { nombreCompleto } from '../../shared/utils/texto';
import type { FiltroCaja } from '../reportes/caja.service';
import { costoDeExternos, costoDePerdidos, costoDeRepuestos } from './orden-repuestos.service';

const LIMITE = 2000;

/**
 * Informe de reparaciones del período (solo admin), en US$.
 *
 * Cuenta las órdenes entregadas en el período. Lo cobrado es el total de la
 * entrega, pasado a dólares con la cotización que se cargó al cobrar; el costo,
 * los repuestos (al costo de la entrada de cada uno, también los que se
 * perdieron al colocarlos) más lo que cobró el taller externo. Una orden
 * cobrada en otra moneda sin cotización no se puede pasar a dólares: se lista
 * aparte y no suma a los totales hasta que se le cargue.
 */
export async function informeReparaciones(filtro: FiltroCaja) {
  const { tallerId, sucursalId, inicio, fin } = filtro.parametros;
  const ordenes = await Orden.findAll({
    where: {
      tallerId,
      estado: 'entregado',
      fechaEntrega: { [Op.gte]: inicio, [Op.lt]: fin },
      ...(sucursalId ? { sucursalId } : {})
    },
    attributes: [
      'id',
      'numeroOrden',
      'fechaEntrega',
      'reparacionSolicitada',
      'moneda',
      'monedaCobro',
      'cotizacionCobro',
      'montoTotal'
    ],
    include: [
      { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido'] },
      { model: Equipo, as: 'equipo', attributes: ['id', 'marca', 'modelo'] }
    ],
    order: [['fechaEntrega', 'DESC']],
    limit: LIMITE
  });
  const ids = ordenes.map((o) => o.id);
  const [repuestos, externos, perdidos] = await Promise.all([
    costoDeRepuestos(ids),
    costoDeExternos(ids),
    costoDePerdidos(ids)
  ]);

  const filas = ordenes.map((orden) => {
    const moneda = orden.monedaCobro ?? orden.moneda;
    const cobrado = aNumero(orden.montoTotal);
    const cotizacion = orden.cotizacionCobro == null ? null : aNumero(orden.cotizacionCobro);
    const cobradoUsd = moneda === 'USD' ? cobrado : cotizacion ? redondearMonto(cobrado / cotizacion) : null;
    const repuestosUsd = repuestos.get(orden.id) ?? 0;
    const externoUsd = externos.get(orden.id) ?? 0;
    const gananciaUsd = cobradoUsd === null ? null : redondearMonto(cobradoUsd - repuestosUsd - externoUsd);
    return {
      id: orden.id,
      numeroOrden: orden.numeroOrden,
      fechaEntrega: orden.fechaEntrega,
      cliente: nombreCompleto(orden.cliente),
      equipo: orden.equipo ? `${orden.equipo.marca} ${orden.equipo.modelo}` : null,
      trabajo: orden.reparacionSolicitada,
      moneda,
      cobrado,
      cotizacion,
      cobradoUsd,
      repuestosUsd,
      perdidosUsd: perdidos.get(orden.id) ?? 0,
      externoUsd,
      gananciaUsd,
      margen: gananciaUsd !== null && cobradoUsd ? redondearMonto((gananciaUsd / cobradoUsd) * 100) : null
    };
  });

  const conDolares = filas.filter((f) => f.cobradoUsd !== null);
  const sumar = (campo: 'cobradoUsd' | 'repuestosUsd' | 'perdidosUsd' | 'externoUsd' | 'gananciaUsd') =>
    redondearMonto(conDolares.reduce((t, f) => t + (f[campo] ?? 0), 0));
  const cobradoUsd = sumar('cobradoUsd');
  const gananciaUsd = sumar('gananciaUsd');

  return {
    rango: { desde: filtro.desde, hasta: filtro.hasta },
    alcance: sucursalId ? 'sucursal' : 'taller',
    resumen: {
      entregadas: filas.length,
      cobradoUsd,
      repuestosUsd: sumar('repuestosUsd'),
      perdidosUsd: sumar('perdidosUsd'),
      externoUsd: sumar('externoUsd'),
      gananciaUsd,
      margen: cobradoUsd > 0 ? redondearMonto((gananciaUsd / cobradoUsd) * 100) : null,
      /** Cobradas en otra moneda sin cotización: no suman hasta que se cargue. */
      sinCotizacion: filas.length - conDolares.length
    },
    ordenes: filas
  };
}
