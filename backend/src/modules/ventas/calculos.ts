import type { TipoDescuento } from '../../models/Venta';
import { type Moneda, redondearMonto } from '../../shared/utils/dinero';

export interface Descuento {
  tipo: TipoDescuento;
  /** 10 es 10 % si es porcentaje, o el monto en la moneda de la venta. */
  valor: number;
}

export interface TotalesVenta {
  subtotal: number;
  descuento: number;
  /** Lo que vale la venta: es el bruto del informe. */
  total: number;
  partePago: number;
  /** Lo que tiene que poner el cliente en plata. */
  aPagar: number;
}

const sumar = (montos: number[]) => redondearMonto(montos.reduce((a, b) => a + b, 0));

/**
 * Cuentas de una venta. La parte de pago no es un descuento: el taller recibe
 * un equipo que vale eso y que entra al stock con ese costo, así que baja lo
 * que se paga en plata pero no lo que vale la venta.
 */
export function totalesDeVenta(
  precios: number[],
  descuento: Descuento | null | undefined,
  partesPago: number[] = []
): TotalesVenta {
  const subtotal = sumar(precios);
  const rebaja = !descuento
    ? 0
    : descuento.tipo === 'porcentaje'
      ? redondearMonto((subtotal * descuento.valor) / 100)
      : redondearMonto(descuento.valor);
  const total = redondearMonto(subtotal - rebaja);
  const partePago = sumar(partesPago);
  return { subtotal, descuento: rebaja, total, partePago, aPagar: redondearMonto(total - partePago) };
}

/** Por qué no cierran las cuentas de la venta, o null si están bien. */
export function problemaDeTotales(totales: TotalesVenta): string | null {
  if (totales.descuento > totales.subtotal)
    return 'El descuento no puede ser mayor que el precio de los equipos.';
  if (totales.partePago > totales.total) {
    return 'Lo que deja el cliente vale más que la venta: bajá el monto de la parte de pago.';
  }
  return null;
}

/** Un pago de la venta en la moneda en que entró la plata. */
export interface PagoEnMoneda {
  monto: number;
  moneda: Moneda;
  /** 1 US$ en la moneda que no es dólar. Solo si el pago es en otra moneda que la venta. */
  cotizacion?: number | null;
}

/**
 * Por qué no se puede tomar un pago en otra moneda, o null. La cotización se
 * lee siempre contra el dólar (como la de la venta y la de los costos), así
 * que uno de los dos, el pago o la venta, tiene que ser en dólares.
 */
export function problemaDePago(pago: PagoEnMoneda, monedaVenta: Moneda): string | null {
  if (pago.moneda === monedaVenta) return null;
  if (pago.moneda !== 'USD' && monedaVenta !== 'USD') {
    return `Una venta en ${monedaVenta} no se puede cobrar en ${pago.moneda}: solo en ${monedaVenta} o en dólares.`;
  }
  if (!pago.cotizacion || pago.cotizacion <= 0) {
    const otra = pago.moneda === 'USD' ? monedaVenta : pago.moneda;
    return `Indicá la cotización del pago en ${pago.moneda}: cuántos ${otra} vale 1 US$.`;
  }
  return null;
}

/** Lo que cubre el pago de la venta, en la moneda de la venta. El pago ya tiene que estar validado. */
export function equivalenteDe(pago: PagoEnMoneda, monedaVenta: Moneda): number {
  if (pago.moneda === monedaVenta) return redondearMonto(pago.monto);
  const cotizacion = pago.cotizacion ?? 0;
  return redondearMonto(pago.moneda === 'USD' ? pago.monto * cotizacion : pago.monto / cotizacion);
}

/** Dos montos de plata son el mismo si no difieren en más de medio centavo. */
export const mismoMonto = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** "VTA-000042": el número con el que se nombra la venta. */
export const etiquetaVenta = (numero: number) => `VTA-${String(numero).padStart(6, '0')}`;
