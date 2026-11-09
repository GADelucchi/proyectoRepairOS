import { apiClient } from '@/shared/api/client';
import type { ClienteInput } from '@/features/clientes/api';
import type {
  CondicionEquipo,
  EstadoVenta,
  InformeVentas,
  MedioPago,
  Moneda,
  TipoDescuento,
  Venta,
  VentaEnLista
} from '@/shared/types';

export type ModoVenta = 'venta' | 'sena' | 'reserva';

/** Un pago, en la moneda en que entra la plata. */
export interface PagoInput {
  monto: number;
  medioPago: MedioPago;
  moneda: Moneda;
  /** 1 US$ en la moneda que no es dólar. Null si es en la moneda de la venta. */
  cotizacion: number | null;
}

export interface PartePagoInput {
  marca: string;
  modelo: string;
  color: string | null;
  almacenamientoGb: number | null;
  condicion: CondicionEquipo;
  bateria: number | null;
  numeroSerie: string | null;
  imei: string | null;
  imei2: string | null;
  monto: number;
  observaciones: string | null;
}

export interface CrearVentaInput {
  clienteId?: number;
  nuevoCliente?: ClienteInput;
  items: { equipoStockId: number; precio: number }[];
  moneda: Moneda;
  cotizacion: number | null;
  descuento: { tipo: TipoDescuento; valor: number } | null;
  partesPago: PartePagoInput[];
  modo: ModoVenta;
  pagos: PagoInput[];
  /** YYYY-MM-DD */
  reservadaHasta: string | null;
  comentarioCliente: string | null;
  comentarioInterno: string | null;
}

export interface FiltroVentas {
  estado?: EstadoVenta;
  search?: string;
  /** Solo tiene efecto para admin. */
  todasLasSucursales?: boolean;
}

export async function listarVentas(filtro: FiltroVentas = {}): Promise<VentaEnLista[]> {
  const { data } = await apiClient.get<VentaEnLista[]>('/ventas', {
    params: { ...filtro, todasLasSucursales: filtro.todasLasSucursales ? 'true' : undefined }
  });
  return data;
}

export async function obtenerVenta(id: number): Promise<Venta> {
  const { data } = await apiClient.get<Venta>(`/ventas/${id}`);
  return data;
}

export async function crearVenta(input: CrearVentaInput): Promise<Venta> {
  const { data } = await apiClient.post<Venta>('/ventas', input);
  return data;
}

/** Pagar sobre una reserva o una seña. Si cubre el saldo, la venta se completa. */
export async function pagarVenta(id: number, pagos: PagoInput[]): Promise<Venta> {
  const { data } = await apiClient.post<Venta>(`/ventas/${id}/pagos`, { pagos });
  return data;
}

export async function extenderReserva(id: number, hasta: string): Promise<Venta> {
  const { data } = await apiClient.post<Venta>(`/ventas/${id}/reserva`, { hasta });
  return data;
}

/** Solo admin. La venta no se borra: queda cancelada y los equipos vuelven al stock. */
export async function cancelarVenta(
  id: number,
  datos: { motivo: string; devolverSena: boolean; medioDevolucion?: MedioPago }
): Promise<Venta> {
  const { data } = await apiClient.post<Venta>(`/ventas/${id}/cancelar`, datos);
  return data;
}

/**
 * Solo admin. Da vuelta una venta completada sin borrarla: queda anulada, los
 * equipos vuelven al stock y lo que dejó en parte de pago se le devuelve.
 */
export async function anularVenta(
  id: number,
  datos: { motivo: string; devolverPlata: boolean; medioDevolucion?: MedioPago }
): Promise<Venta> {
  const { data } = await apiClient.post<Venta>(`/ventas/${id}/anular`, datos);
  return data;
}

export async function descargarPdf(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/ventas/${id}/pdf`, { responseType: 'blob' });
  return data;
}

/** Costo, bruto y ganancia del período en US$ (solo admin). */
export async function obtenerInforme(rango: {
  desde: string;
  hasta: string;
  todasLasSucursales?: boolean;
}): Promise<InformeVentas> {
  const { data } = await apiClient.get<InformeVentas>('/ventas/informe', {
    params: {
      desde: rango.desde,
      hasta: rango.hasta,
      ...(rango.todasLasSucursales ? { todasLasSucursales: 'true' } : {})
    }
  });
  return data;
}
