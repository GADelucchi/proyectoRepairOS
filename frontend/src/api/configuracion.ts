import { apiClient } from './client';
import { TipoEquipoPersonalizado, ChequeoPersonalizado } from '../types';

// Tipos de equipo personalizados
export async function listarTiposEquipo(): Promise<TipoEquipoPersonalizado[]> {
  const { data } = await apiClient.get<TipoEquipoPersonalizado[]>('/configuracion/tipos-equipo');
  return data;
}

export async function crearTipoEquipo(nombre: string): Promise<TipoEquipoPersonalizado> {
  const { data } = await apiClient.post<TipoEquipoPersonalizado>('/configuracion/tipos-equipo', { nombre });
  return data;
}

export async function actualizarTipoEquipo(id: number, nombre?: string): Promise<TipoEquipoPersonalizado> {
  const payload: any = {};
  if (nombre !== undefined) payload.nombre = nombre;
  const { data } = await apiClient.put<TipoEquipoPersonalizado>(`/configuracion/tipos-equipo/${id}`, payload);
  return data;
}

export async function eliminarTipoEquipo(id: number): Promise<void> {
  await apiClient.delete(`/configuracion/tipos-equipo/${id}`);
}

// Chequeos personalizados
export async function listarChequeos(tipoEquipoId: number): Promise<ChequeoPersonalizado[]> {
  const { data } = await apiClient.get<ChequeoPersonalizado[]>(
    `/configuracion/tipos-equipo/${tipoEquipoId}/chequeos`
  );
  return data;
}

export async function guardarChequeos(
  tipoEquipoId: number,
  chequeos: ChequeoPersonalizado[]
): Promise<ChequeoPersonalizado[]> {
  const { data } = await apiClient.post<ChequeoPersonalizado[]>(
    `/configuracion/tipos-equipo/${tipoEquipoId}/chequeos`,
    { chequeos }
  );
  return data;
}
