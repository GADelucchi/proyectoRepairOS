import type { TipoDescuento } from '../../models/Venta';
import { redondearMonto } from '../../shared/utils/dinero';

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

/** Dos montos de plata son el mismo si no difieren en más de medio centavo. */
export const mismoMonto = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** "VTA-000042": el número con el que se nombra la venta. */
export const etiquetaVenta = (numero: number) => `VTA-${String(numero).padStart(6, '0')}`;
