/** Formatea un monto en pesos, sin decimales cuando son cero. */
export function formatearMonto(valor: number): string {
  return valor.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: valor % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}
