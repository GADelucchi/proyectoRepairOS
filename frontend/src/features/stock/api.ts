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

/** Saca el equipo del stock sin borrarlo: queda dado de baja con el motivo (solo admin). */
export async function darDeBajaEquipoStock(id: number, motivo: string): Promise<EquipoStock> {
  const { data } = await apiClient.post<EquipoStock>(`/stock/${id}/baja`, { motivo });
  return data;
}

/** Los proveedores que ya se usaron en el taller, el último primero. */
export async function listarProveedores(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/stock/proveedores');
  return data;
}

export interface EquipoRepetido {
  id: number;
  numero: number;
  etiqueta: string;
  marca: string;
  modelo: string;
  estado: EstadoStock;
}

/** El equipo del stock que ya tiene ese IMEI o ese serial, o null. */
export async function verificarRepetido(params: {
  imei?: string;
  numeroSerie?: string;
  excluirId?: number;
}): Promise<EquipoRepetido | null> {
  const { data } = await apiClient.get<{ repetido: EquipoRepetido | null }>('/stock/verificar', { params });
  return data.repetido;
}

export interface CostoReparacionInput {
  concepto: string;
  moneda: Moneda;
  monto: number;
  /** 1 US$ en la moneda del costo. Null si es en dólares. */
  cotizacion: number | null;
}

/** Suma un costo al equipo (solo admin). Devuelve el equipo con el costo nuevo. */
export async function agregarCosto(id: number, input: CostoReparacionInput): Promise<EquipoStock> {
  const { data } = await apiClient.post<EquipoStock>(`/stock/${id}/costos`, input);
  return data;
}

/** El costo queda anulado (no se borra) y deja de sumar. */
export async function anularCosto(id: number, costoId: number): Promise<EquipoStock> {
  const { data } = await apiClient.post<EquipoStock>(`/stock/${id}/costos/${costoId}/anular`);
  return data;
}
