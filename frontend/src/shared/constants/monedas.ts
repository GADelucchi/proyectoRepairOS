import type { Moneda } from '@/shared/types';

/** Mismas monedas que acepta la API (`MONEDAS` en el backend). */
export const MONEDAS: readonly Moneda[] = [
  'ARS',
  'USD',
  'EUR',
  'CLP',
  'UYU',
  'BRL',
  'PYG',
  'BOB',
  'PEN',
  'MXN',
  'COP'
];

export const MONEDA_POR_DEFECTO: Moneda = 'ARS';

export const NOMBRE_MONEDA: Record<Moneda, string> = {
  ARS: 'Pesos argentinos',
  USD: 'Dólares',
  EUR: 'Euros',
  CLP: 'Pesos chilenos',
  UYU: 'Pesos uruguayos',
  BRL: 'Reales',
  PYG: 'Guaraníes',
  BOB: 'Bolivianos',
  PEN: 'Soles',
  MXN: 'Pesos mexicanos',
  COP: 'Pesos colombianos'
};
