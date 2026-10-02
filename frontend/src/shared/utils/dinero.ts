import type { Monto } from '@/shared/types';

/** Convierte un monto de la API (string DECIMAL) o un input del usuario a número. */
export function aNumero(valor: Monto | null | undefined): number {
  const numero = Number(String(valor ?? 0).replace(',', '.'));
  return Number.isFinite(numero) ? numero : 0;
}

/** Redondea a centavos. */
export function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Formatea un monto en pesos, sin decimales cuando son cero. */
export function formatearMonto(valor: Monto): string {
  const numero = aNumero(valor);
  return numero.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: numero % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}
