/**
 * Monedas en las que se puede presupuestar y cobrar (ISO 4217).
 *
 * Una orden se presupuesta en una y se puede cobrar en otra, y lo que genera
 * (cargo, cobro, saldo) queda en la que se cobró: los saldos y la caja se llevan
 * por moneda y nunca se suman entre sí.
 */
export const MONEDAS = ['ARS', 'USD', 'EUR', 'CLP', 'UYU', 'BRL', 'PYG', 'BOB', 'PEN', 'MXN', 'COP'] as const;
export type Moneda = (typeof MONEDAS)[number];

export const MONEDA_POR_DEFECTO: Moneda = 'ARS';

/** Redondea a dos decimales, que es la precisión con la que se guarda la plata. */
export function redondearMonto(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Convierte un DECIMAL de la base (que Sequelize devuelve como string) a número. */
export function aNumero(valor: string | number | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

/** $ 12.345,67 · US$ 120,00 · € 50,00 */
export function formatearMonto(valor: number | string, moneda: string = MONEDA_POR_DEFECTO): string {
  return aNumero(valor).toLocaleString('es-AR', { style: 'currency', currency: moneda });
}

/** "USD 120.00": para textos que quedan guardados (historial, notas). */
export function montoConMoneda(valor: number, moneda: string): string {
  return `${moneda} ${valor.toFixed(2)}`;
}

/**
 * Un monto pasado a dólares con la cotización guardada (1 US$ en esa moneda).
 * Es como se suman costos y ventas del stock, que se informan en US$.
 */
export function enDolares(
  valor: number | string,
  moneda: string,
  cotizacion: number | string | null | undefined
): number {
  if (moneda === 'USD') return redondearMonto(aNumero(valor));
  const porDolar = aNumero(cotizacion);
  if (porDolar <= 0) throw new Error(`Falta la cotización para pasar ${moneda} a US$`);
  return redondearMonto(aNumero(valor) / porDolar);
}

/**
 * "1 USD = 1200 ARS": la cotización que resulta de pagar una deuda en otra moneda.
 * Siempre se lee contra la moneda local, gire para donde gire la operación.
 */
export function textoCotizacion(
  monedaDeuda: string,
  montoDeuda: number,
  monedaPago: string,
  montoPago: number
): string {
  const [base, baseMonto, otra, otraMonto] =
    monedaDeuda === MONEDA_POR_DEFECTO
      ? [monedaPago, montoPago, monedaDeuda, montoDeuda]
      : [monedaDeuda, montoDeuda, monedaPago, montoPago];
  return `1 ${base} = ${Number((otraMonto / baseMonto).toFixed(4))} ${otra}`;
}
