import { apiClient } from './client';
import {
  Orden,
  OrdenChequeo,
  OrdenImagen,
  EstadoOrden,
  OpcionChequeo,
  ResultadoNotificacion,
  MedioPago,
  Solicitud
} from '../types';
import { ClienteInput } from './clientes';

export interface ChequeoInput {
  item: string;
  resultado?: string | null;
  opciones?: OpcionChequeo[];
  orden?: number;
}

/** La orden vuelve con el detalle de qué pasó al avisarle al cliente. */
export type OrdenConNotificacion = Orden & { notificacion?: ResultadoNotificacion | null };

export interface NuevaOrdenInput {
  clienteId?: number;
  /** Mismos campos que el alta desde la pantalla de Clientes. */
  nuevoCliente?: ClienteInput;
  equipoId?: number;
  nuevoEquipo?: {
    tipoEquipoPersonalizadoId: number;
    marca?: string | null;
    modelo?: string | null;
    color?: string | null;
    numeroSerie?: string | null;
    claveDesbloqueo?: string | null;
    cuentaUsuario?: string | null;
    cuentaPassword?: string | null;
  };
  detallesEsteticos?: string | null;
  reparacionSolicitada: string;
  notasInternas?: string | null;
  fechaPactada?: string | null;
  presupuestoMonto?: number | null;
  chequeos?: ChequeoInput[];
}

export async function listarOrdenes(estado?: EstadoOrden): Promise<Orden[]> {
  const { data } = await apiClient.get<Orden[]>('/ordenes', { params: estado ? { estado } : undefined });
  return data;
}

export async function obtenerOrden(id: number): Promise<Orden> {
  const { data } = await apiClient.get<Orden>(`/ordenes/${id}`);
  return data;
}

export async function crearOrden(input: NuevaOrdenInput): Promise<Orden> {
  const { data } = await apiClient.post<Orden>('/ordenes', input);
  return data;
}

export async function actualizarOrden(id: number, input: Partial<NuevaOrdenInput>): Promise<Orden> {
  const { data } = await apiClient.put<Orden>(`/ordenes/${id}`, input);
  return data;
}

export async function cambiarEstadoOrden(
  id: number,
  estado: EstadoOrden,
  comentario?: string,
  forzar?: boolean
): Promise<OrdenConNotificacion> {
  const { data } = await apiClient.put<OrdenConNotificacion>(`/ordenes/${id}/estado`, {
    estado,
    comentario,
    forzar
  });
  return data;
}

export interface EntregaInput {
  montoTotal: number;
  montoAbonado: number;
  medioPago?: MedioPago | null;
  comentario?: string | null;
  forzar?: boolean;
}

/** La entrega devuelve el saldo resultante y cuánto crédito se usó. */
export type OrdenEntregada = OrdenConNotificacion & {
  saldoCliente: number;
  pendiente: number;
  creditoAplicado: number;
};

/**
 * Entrega el equipo y registra el cobro en una sola llamada.
 * Lo que no se abone queda en la cuenta corriente del cliente.
 */
export async function entregarOrden(id: number, input: EntregaInput): Promise<OrdenEntregada> {
  const { data } = await apiClient.post<OrdenEntregada>(`/ordenes/${id}/entrega`, input);
  return data;
}

export interface SolicitudFiadoInput {
  montoTotal: number;
  montoAbonado: number;
  medioPago?: MedioPago | null;
  motivo: string;
}

/**
 * Pide autorización para entregar dejando saldo en un cliente sin cuenta
 * corriente. Si quien pide es admin, la entrega se hace en el acto.
 */
export async function solicitarFiado(
  id: number,
  input: SolicitudFiadoInput
): Promise<{ solicitud: Solicitud; autorizada: boolean; saldoCliente?: number }> {
  const { data } = await apiClient.post(`/ordenes/${id}/entrega/solicitar`, input);
  return data;
}

export async function actualizarPresupuesto(
  id: number,
  payload: { monto?: number | null; aprobado?: boolean | null }
): Promise<OrdenConNotificacion> {
  const { data } = await apiClient.put<OrdenConNotificacion>(`/ordenes/${id}/presupuesto`, payload);
  return data;
}

export async function reemplazarChequeos(id: number, chequeos: ChequeoInput[]): Promise<OrdenChequeo[]> {
  const { data } = await apiClient.put<OrdenChequeo[]>(`/ordenes/${id}/chequeos`, chequeos);
  return data;
}

export interface EditarOrdenInput {
  detallesEsteticos?: string | null;
  reparacionSolicitada?: string;
  notasInternas?: string | null;
  fechaPactada?: string | null;
}

export async function editarOrden(id: number, input: EditarOrdenInput): Promise<Orden> {
  const { data } = await apiClient.put<Orden>(`/ordenes/${id}`, input);
  return data;
}

export async function subirImagenes(id: number, files: File[]): Promise<OrdenImagen[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('imagenes', file));
  const { data } = await apiClient.post<OrdenImagen[]>(`/ordenes/${id}/imagenes`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
}

export async function eliminarImagen(ordenId: number, imagenId: number): Promise<void> {
  await apiClient.delete(`/ordenes/${ordenId}/imagenes/${imagenId}`);
}

export async function guardarFirma(id: number, firmaBase64: string): Promise<{ firmaClienteUrl: string }> {
  const { data } = await apiClient.post(`/ordenes/${id}/firma`, { firmaBase64 });
  return data;
}

export async function descargarPdfUrl(id: number): Promise<Blob> {
  const { data } = await apiClient.get(`/ordenes/${id}/pdf`, { responseType: 'blob' });
  return data;
}
