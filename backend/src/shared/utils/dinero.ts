/**
 * Monedas en las que se puede presupuestar y cobrar (ISO 4217).
 *
 * Cada orden tiene la suya y todo lo que genera (cargo, cobro, saldo) queda en
 * esa moneda: los saldos y la caja se llevan por moneda y nunca se suman entre sí.
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
