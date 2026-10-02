/** Redondea a dos decimales, que es la precisión con la que se guarda la plata. */
export function redondearMonto(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Convierte un DECIMAL de la base (que Sequelize devuelve como string) a número. */
export function aNumero(valor: string | number | null | undefined): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

/** $ 12.345,67 */
export function formatearMonto(valor: number | string): string {
  return aNumero(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}
