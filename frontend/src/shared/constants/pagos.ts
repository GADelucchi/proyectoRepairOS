import type { MedioPago, TipoMovimiento } from '@/shared/types';

/** Los que se ofrecen al cobrar. `tarjeta` solo aparece en cobros viejos. */
export const MEDIOS_PAGO: readonly MedioPago[] = [
  'efectivo',
  'transferencia',
  'tarjeta_debito',
  'tarjeta_credito',
  'otro'
];

export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta: 'Tarjeta (sin especificar)',
  otro: 'Otro'
};

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  cargo: 'Cargo',
  pago: 'Cobro',
  ajuste_debito: 'Ajuste (suma deuda)',
  ajuste_credito: 'Ajuste (a favor)'
};

/** Los movimientos que suman deuda van en la columna "Debe". */
export const esDebito = (tipo: TipoMovimiento) => tipo === 'cargo' || tipo === 'ajuste_debito';
