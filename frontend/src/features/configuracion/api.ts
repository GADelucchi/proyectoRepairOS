import { apiClient } from '@/shared/api/client';
import type { ChequeoPersonalizado, Taller, TipoEquipoPersonalizado } from '@/shared/types';

/** Tipos de equipo de la sucursal activa. */
export async function listarTiposEquipo(): Promise<TipoEquipoPersonalizado[]> {
  const { data } = await apiClient.get<TipoEquipoPersonalizado[]>('/configuracion/tipos-equipo');
  return data;
}

export async function crearTipoEquipo(nombre: string): Promise<TipoEquipoPersonalizado> {
  const { data } = await apiClient.post<TipoEquipoPersonalizado>('/configuracion/tipos-equipo', { nombre });
  return data;
}

export async function renombrarTipoEquipo(id: number, nombre: string): Promise<TipoEquipoPersonalizado> {
  const { data } = await apiClient.put<TipoEquipoPersonalizado>(`/configuracion/tipos-equipo/${id}`, {
    nombre
  });
  return data;
}

export async function eliminarTipoEquipo(id: number): Promise<void> {
  await apiClient.delete(`/configuracion/tipos-equipo/${id}`);
}

/** Checklist de recepción de un tipo de equipo. */
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

/** Nombre y país del taller (solo admin). El país define la moneda por defecto. */
export async function actualizarTaller(datos: { nombre?: string; pais?: string }): Promise<Taller> {
  const { data } = await apiClient.put<Taller>('/configuracion/taller', datos);
  return data;
}
