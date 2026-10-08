import type { Moneda } from './dinero';

/**
 * Países donde puede estar un taller: de acá salen la moneda por defecto de sus
 * órdenes y el prefijo para armar los links de WhatsApp a sus clientes.
 * Misma lista que `frontend/src/shared/constants/paises.ts`.
 */
export const PAISES = {
  AR: { nombre: 'Argentina', moneda: 'ARS', prefijo: '54' },
  UY: { nombre: 'Uruguay', moneda: 'UYU', prefijo: '598' },
  CL: { nombre: 'Chile', moneda: 'CLP', prefijo: '56' },
  PY: { nombre: 'Paraguay', moneda: 'PYG', prefijo: '595' },
  BO: { nombre: 'Bolivia', moneda: 'BOB', prefijo: '591' },
  BR: { nombre: 'Brasil', moneda: 'BRL', prefijo: '55' },
  PE: { nombre: 'Perú', moneda: 'PEN', prefijo: '51' },
  CO: { nombre: 'Colombia', moneda: 'COP', prefijo: '57' },
  MX: { nombre: 'México', moneda: 'MXN', prefijo: '52' },
  EC: { nombre: 'Ecuador', moneda: 'USD', prefijo: '593' },
  PA: { nombre: 'Panamá', moneda: 'USD', prefijo: '507' },
  SV: { nombre: 'El Salvador', moneda: 'USD', prefijo: '503' },
  US: { nombre: 'Estados Unidos', moneda: 'USD', prefijo: '1' },
  ES: { nombre: 'España', moneda: 'EUR', prefijo: '34' }
} as const satisfies Record<string, { nombre: string; moneda: Moneda; prefijo: string }>;

export type CodigoPais = keyof typeof PAISES;
export const CODIGOS_PAIS = Object.keys(PAISES) as [CodigoPais, ...CodigoPais[]];
export const PAIS_POR_DEFECTO: CodigoPais = 'AR';

/** Moneda en la que arranca una orden nueva del taller. */
export function monedaDePais(pais: string): Moneda {
  return (PAISES[pais as CodigoPais] ?? PAISES[PAIS_POR_DEFECTO]).moneda;
}
