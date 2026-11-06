import type { MedioPago, Moneda, OrdenPrecio } from '@/shared/types';
import { aNumero } from '@/shared/utils/dinero';

/** Un precio tal como lo edita el usuario. Sin medio: vale para cualquiera. */
export interface PrecioForm {
  medioPago: MedioPago | '';
  moneda: Moneda;
  monto: string;
}

export const preciosAFormulario = (precios: OrdenPrecio[] = []): PrecioForm[] =>
  precios.map((p) => ({ medioPago: p.medioPago ?? '', moneda: p.moneda, monto: String(aNumero(p.monto)) }));

/** Lo que espera la API. Un renglón sin monto no es un precio: se descarta. */
export const formularioAPrecios = (precios: PrecioForm[]) =>
  precios
    .filter((p) => aNumero(p.monto) > 0)
    .map((p) => ({ medioPago: p.medioPago || null, moneda: p.moneda, monto: aNumero(p.monto) }));
