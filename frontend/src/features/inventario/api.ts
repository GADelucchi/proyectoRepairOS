import { apiClient } from '@/shared/api/client';
import type {
  Articulo,
  ArticuloDetalle,
  ArticuloResumen,
  CategoriaInventario,
  ConfigInventario,
  Moneda,
  Pase,
  TipoArticulo
} from '@/shared/types';

export interface FiltroArticulos {
  /** `productos` son repuestos y accesorios. */
  tipo?: TipoArticulo | 'productos';
  categoriaId?: number;
  search?: string;
  /** Sin indicar, la sucursal elegida. */
  sucursal?: number | 'todas';
  bajoMinimo?: boolean;
  archivados?: boolean;
}

export interface ResumenInventario {
  productos: number;
  unidades: number;
  costoStockUsd: number | null;
  bajoMinimo: number;
}

export async function listarArticulos(
  filtro: FiltroArticulos = {}
): Promise<{ articulos: Articulo[]; resumen: ResumenInventario; config: ConfigInventario }> {
  const { data } = await apiClient.get('/inventario/articulos', { params: filtro });
  return data;
}

export async function obtenerArticulo(id: number, sucursal?: number): Promise<ArticuloDetalle> {
  const { data } = await apiClient.get<ArticuloDetalle>(`/inventario/articulos/${id}`, {
    params: sucursal ? { sucursal } : undefined
  });
  return data;
}

/** El artículo con ese código o código de barras (lo que lee el escáner). */
export async function buscarPorCodigo(codigo: string): Promise<ArticuloResumen> {
  const { data } = await apiClient.get<ArticuloResumen>('/inventario/articulos/codigo', {
    params: { codigo }
  });
  return data;
}

export interface PrecioInput {
  monto: number;
  moneda: Moneda;
}

export interface CompraInput {
  moneda: Moneda;
  cotizacion: number | null;
  /** YYYY-MM-DD */
  fecha?: string | null;
  proveedor: string | null;
  nota: string | null;
}

export interface ArticuloInput {
  categoriaId: number | null;
  nombre: string;
  codigo: string | null;
  codigoBarras: string | null;
  stockMinimo?: number;
  /** Las tres posiciones de precio; null es sin precio. */
  precios: (PrecioInput | null)[];
  /** Solo para un servicio. */
  repuestos?: { repuestoId: number; cantidad: number }[];
}

export async function crearArticulo(
  input: ArticuloInput & {
    tipo: TipoArticulo;
    entrada?: (CompraInput & { cantidad: number; costo: number }) | null;
  }
): Promise<ArticuloDetalle> {
  const { data } = await apiClient.post<ArticuloDetalle>('/inventario/articulos', input);
  return data;
}

export async function actualizarArticulo(id: number, input: ArticuloInput): Promise<ArticuloDetalle> {
  const { data } = await apiClient.put<ArticuloDetalle>(`/inventario/articulos/${id}`, input);
  return data;
}

/** Archivado deja de aparecer para usar o vender, pero sigue en el historial (solo admin). */
export async function archivarArticulo(id: number, activo: boolean): Promise<ArticuloDetalle> {
  const { data } = await apiClient.post<ArticuloDetalle>(`/inventario/articulos/${id}/archivar`, { activo });
  return data;
}

/** Una compra: una línea por producto, todas en la sucursal elegida. */
export async function cargarEntrada(
  input: CompraInput & { lineas: { articuloId: number; cantidad: number; costo: number }[] }
): Promise<{ id: number; etiqueta: string; articuloId: number }[]> {
  const { data } = await apiClient.post('/inventario/entradas', input);
  return data;
}

/** Saca unidades de una entrada sin usarlas (solo admin). */
export async function darDeBajaUnidades(entradaId: number, cantidad: number, motivo: string): Promise<void> {
  await apiClient.post(`/inventario/entradas/${entradaId}/baja`, { cantidad, motivo });
}

export async function listarProveedores(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/inventario/proveedores');
  return data;
}

/** La última cotización que usó el taller en esa moneda, para proponerla. */
export async function cotizacionSugerida(moneda: Moneda): Promise<number | null> {
  const { data } = await apiClient.get<{ cotizacion: number | null }>('/inventario/cotizacion', {
    params: { moneda }
  });
  return data.cotizacion;
}

export async function obtenerConfig(): Promise<{
  config: ConfigInventario;
  categorias: CategoriaInventario[];
  pasesPorRecibir: number;
}> {
  const { data } = await apiClient.get('/inventario/config');
  return data;
}

export async function guardarConfig(config: ConfigInventario): Promise<ConfigInventario> {
  const { data } = await apiClient.put<ConfigInventario>('/inventario/config', config);
  return data;
}

export async function crearCategoria(grupo: TipoArticulo, nombre: string): Promise<CategoriaInventario> {
  const { data } = await apiClient.post<CategoriaInventario>('/inventario/categorias', { grupo, nombre });
  return data;
}

export async function renombrarCategoria(id: number, nombre: string): Promise<void> {
  await apiClient.put(`/inventario/categorias/${id}`, { nombre });
}

export async function borrarCategoria(id: number): Promise<void> {
  await apiClient.delete(`/inventario/categorias/${id}`);
}

export async function listarPases(): Promise<{
  pases: Pase[];
  sucursales: { id: number; nombre: string }[];
}> {
  const { data } = await apiClient.get('/inventario/pases');
  return data;
}

export type ItemPaseInput = { articuloId: number; cantidad: number } | { equipoStockId: number };

export async function crearPase(input: {
  sucursalDestinoId: number;
  nota: string | null;
  items: ItemPaseInput[];
}): Promise<Pase> {
  const { data } = await apiClient.post<Pase>('/inventario/pases', input);
  return data;
}

export async function recibirPase(id: number): Promise<Pase> {
  const { data } = await apiClient.post<Pase>(`/inventario/pases/${id}/recibir`);
  return data;
}

export async function cancelarPase(id: number): Promise<Pase> {
  const { data } = await apiClient.post<Pase>(`/inventario/pases/${id}/cancelar`);
  return data;
}

export interface ResultadoAjuste {
  habia: number;
  contada: number;
  diferencia: number;
  articulo: ArticuloDetalle;
}

/**
 * Deja en la sucursal la cantidad que se contó (solo admin). Lo que sobra entra
 * con `costo` o, sin indicarlo, con el de la última compra.
 */
export async function ajustarPorConteo(
  id: number,
  input: {
    cantidadContada: number;
    motivo: string;
    costo?: { moneda: Moneda; monto: number; cotizacion: number | null } | null;
  }
): Promise<ResultadoAjuste> {
  const { data } = await apiClient.post<ResultadoAjuste>(`/inventario/articulos/${id}/ajuste`, input);
  return data;
}
