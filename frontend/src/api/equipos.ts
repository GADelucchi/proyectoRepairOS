import { apiClient } from './client';
import { Equipo } from '../types';

export async function listarEquipos(params?: { search?: string; clienteId?: number }): Promise<Equipo[]> {
  const { data } = await apiClient.get<Equipo[]>('/equipos', { params });
  return data;
}

export async function obtenerEquipo(id: number, reveal = false): Promise<Equipo> {
  const { data } = await apiClient.get<Equipo>(`/equipos/${id}`, {
    params: reveal ? { reveal: 'true' } : undefined
  });
  return data;
}

export type EquipoInput = Omit<Equipo, 'id' | 'createdAt' | 'cliente'>;

export async function crearEquipo(input: EquipoInput): Promise<Equipo> {
  const { data } = await apiClient.post<Equipo>('/equipos', input);
  return data;
}

export async function actualizarEquipo(id: number, input: Partial<EquipoInput>): Promise<Equipo> {
  const { data } = await apiClient.put<Equipo>(`/equipos/${id}`, input);
  return data;
}

export async function eliminarEquipo(id: number): Promise<void> {
  await apiClient.delete(`/equipos/${id}`);
}

export async function generarNumeroSerie(): Promise<string> {
  const { data } = await apiClient.get<{ numeroSerie: string }>('/equipos/generar/numero-serie');
  return data.numeroSerie;
}
