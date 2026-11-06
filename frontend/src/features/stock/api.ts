import { apiClient } from '@/shared/api/client';
import type { CondicionEquipo, EquipoStock, EstadoStock, Moneda, ResumenStock } from '@/shared/types';

/** Cuerpo para cargar o editar un equipo. Al editar se manda completo. */
export interface EquipoStockInput {
  marca: string;
  modelo: string;
  color: string | null;
  almacenamientoGb: number | null;
  condicion: CondicionEquipo;
  bateria: number | null;
  numeroSerie: string | null;
  imei: string | null;
  imei2: string | null;
  /** YYYY-MM-DD */
  fechaCompra: string;
  proveedor: string | null;
  monedaCosto: Moneda;
  costo: number;
  cotizacionCosto: number | null;
  monedaPrecio: Moneda | null;
  precio: number | null;
  observaciones: string | null;
}

export interface FiltroStock {
  estado?: EstadoStock;
  condicion?: CondicionEquipo;
  search?: string;
  /** Sin indicar, la sucursal elegida. */
  sucursal?: number | 'todas';
}

export async function listarStock(
  filtro: FiltroStock = {}
): Promise<{ equipos: EquipoStock[]; resumen: ResumenStock }> {
  const { data } = await apiClient.get('/stock', { params: filtro });
  return data;
}

export async function obtenerEquipoStock(id: number): Promise<EquipoStock> {
  const { data } = await apiClient.get<EquipoStock>(`/stock/${id}`);
  return data;
}

export async function crearEquipoStock(input: EquipoStockInput): Promise<EquipoStock> {
  const { data } = await apiClient.post<EquipoStock>('/stock', input);
  return data;
}

export async function actualizarEquipoStock(id: number, input: EquipoStockInput): Promise<EquipoStock> {
  const { data } = await apiClient.put<EquipoStock>(`/stock/${id}`, input);
  return data;
}

export async function eliminarEquipoStock(id: number): Promise<void> {
  await apiClient.delete(`/stock/${id}`);
}
