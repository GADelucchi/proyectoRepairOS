import { apiClient } from '@/shared/api/client';
import type { MovimientoCaja, ResumenCaja } from '@/shared/types';

export interface RangoCaja {
  desde?: string;
  hasta?: string;
  /** Solo tiene efecto para admin; el técnico ve siempre su sucursal. */
  todasLasSucursales?: boolean;
}

const aParams = (rango?: RangoCaja) => ({
  ...(rango?.desde ? { desde: rango.desde } : {}),
  ...(rango?.hasta ? { hasta: rango.hasta } : {}),
  ...(rango?.todasLasSucursales ? { todasLasSucursales: 'true' } : {})
});

export async function obtenerCaja(rango?: RangoCaja): Promise<ResumenCaja> {
  const { data } = await apiClient.get<ResumenCaja>('/reportes/caja', { params: aParams(rango) });
  return data;
}

export async function movimientosDeCaja(rango?: RangoCaja): Promise<MovimientoCaja[]> {
  const { data } = await apiClient.get<MovimientoCaja[]>('/reportes/caja/movimientos', {
    params: aParams(rango)
  });
  return data;
}
