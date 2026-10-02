import { apiClient } from '@/shared/api/client';
import type { Equipo } from '@/shared/types';

/** Cuerpo para crear o editar un equipo. Las credenciales viajan en claro y la API las cifra. */
export interface EquipoInput {
  clienteId: number;
  tipoEquipoPersonalizadoId: number;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  numeroSerie: string;
  claveDesbloqueo: string | null;
  cuentaUsuario: string | null;
  cuentaPassword: string | null;
}

export async function listarEquipos(params?: { search?: string; clienteId?: number }): Promise<Equipo[]> {
  const { data } = await apiClient.get<Equipo[]>('/equipos', { params });
  return data;
}

/** Con `revelar`, las credenciales vienen descifradas y la consulta queda auditada. */
export async function obtenerEquipo(id: number, revelar = false): Promise<Equipo> {
  const { data } = await apiClient.get<Equipo>(`/equipos/${id}`, {
    params: revelar ? { reveal: 'true' } : undefined
  });
  return data;
}

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
