import { Op } from 'sequelize';
import { Cliente, EquipoStock, User, Venta, VentaItem } from '../../models';
import { aNumero, enDolares, redondearMonto } from '../../shared/utils/dinero';
import { nombreCompleto } from '../../shared/utils/texto';
import type { FiltroCaja } from '../reportes/caja.service';
import { costoTotalUsd } from '../stock/stock.service';
import { etiquetaVenta } from './calculos';

const LIMITE = 2000;

/**
 * Informe de ventas del período (solo admin), en US$.
 *
 * Cuenta las ventas completadas, por la fecha en que se completaron. El bruto es
 * lo que vale cada venta (con su descuento); el costo es la suma de lo que costó
 * cada unidad vendida, con la cotización del día en que se compró, más lo que se
 * le agregó después (reparaciones, repuestos). La parte de
 * pago no resta: es un equipo que entró al stock y que se va a vender después.
 */
export async function informeVentas(filtro: FiltroCaja) {
  const { tallerId, sucursalId, inicio, fin } = filtro.parametros;
  const ventas = await Venta.findAll({
    where: {
      tallerId,
      estado: 'completada',
      completadaEn: { [Op.gte]: inicio, [Op.lt]: fin },
      ...(sucursalId ? { sucursalId } : {})
    },
    include: [
      { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido'] },
      { model: User, as: 'vendedor', attributes: ['id', 'nombre', 'apellido'] },
      { model: VentaItem, as: 'items', include: [{ model: EquipoStock, as: 'equipo' }] }
    ],
    order: [['completadaEn', 'DESC']],
    limit: LIMITE
  });

  const filas = ventas.map((venta) => {
    const items = venta.items ?? [];
    const brutoUsd = enDolares(venta.total, venta.moneda, venta.cotizacion);
    const costoUsd = redondearMonto(
      items.reduce((total, i) => total + (i.equipo ? costoTotalUsd(i.equipo) : 0), 0)
    );
    return {
      id: venta.id,
      etiqueta: etiquetaVenta(venta.numero),
      completadaEn: venta.completadaEn,
      cliente: nombreCompleto(venta.cliente),
      vendedor: nombreCompleto(venta.vendedor) || null,
      moneda: venta.moneda,
      total: aNumero(venta.total),
      cotizacion: venta.cotizacion == null ? null : aNumero(venta.cotizacion),
      equipos: items.map((i) => ({
        numero: i.equipo?.numero ?? null,
        marca: i.equipo?.marca ?? '',
        modelo: i.equipo?.modelo ?? '',
        almacenamientoGb: i.equipo?.almacenamientoGb ?? null
      })),
      brutoUsd,
      costoUsd,
      gananciaUsd: redondearMonto(brutoUsd - costoUsd),
      partePagoUsd: enDolares(venta.partePago, venta.moneda, venta.cotizacion)
    };
  });

  const sumar = (campo: 'brutoUsd' | 'costoUsd' | 'gananciaUsd' | 'partePagoUsd') =>
    redondearMonto(filas.reduce((t, f) => t + f[campo], 0));
  const bruto = sumar('brutoUsd');
  const ganancia = sumar('gananciaUsd');

  return {
    rango: { desde: filtro.desde, hasta: filtro.hasta },
    alcance: sucursalId ? 'sucursal' : 'taller',
    resumen: {
      ventas: filas.length,
      equipos: filas.reduce((t, f) => t + f.equipos.length, 0),
      brutoUsd: bruto,
      costoUsd: sumar('costoUsd'),
      gananciaUsd: ganancia,
      /** Ganancia sobre el bruto, en %. */
      margen: bruto > 0 ? redondearMonto((ganancia / bruto) * 100) : null,
      partePagoUsd: sumar('partePagoUsd')
    },
    ventas: filas
  };
}
