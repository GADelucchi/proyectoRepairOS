import { apiClient } from './client';
import { EstadoSolicitud, Solicitud } from '../types';

export async function listarSolicitudes(estado?: EstadoSolicitud): Promise<Solicitud[]> {
  const { data } = await apiClient.get<Solicitud[]>('/solicitudes', {
    params: estado ? { estado } : undefined
  });
  return data;
}

/** Alimenta el aviso del menú, así el admin no tiene que ir a mirar. */
export async function contarPendientes(): Promise<number> {
  const { data } = await apiClient.get<{ pendientes: number }>('/solicitudes/pendientes/contador');
  return data.pendientes;
}

export async function aprobarSolicitud(
  id: number,
  respuesta?: string | null
): Promise<{ solicitud: Solicitud; saldoCliente: number }> {
  const { data } = await apiClient.post(`/solicitudes/${id}/aprobar`, { respuesta });
  return data;
}

export async function rechazarSolicitud(id: number, respuesta?: string | null): Promise<Solicitud> {
  const { data } = await apiClient.post<Solicitud>(`/solicitudes/${id}/rechazar`, { respuesta });
  return data;
}

export async function cancelarSolicitud(id: number): Promise<Solicitud> {
  const { data } = await apiClient.post<Solicitud>(`/solicitudes/${id}/cancelar`, {});
  return data;
}
