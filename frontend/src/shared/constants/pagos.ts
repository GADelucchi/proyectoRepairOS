import type { MedioPago, TipoMovimiento } from '@/shared/types';

export const MEDIOS_PAGO: readonly MedioPago[] = ['efectivo', 'transferencia', 'tarjeta', 'otro'];

export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
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
