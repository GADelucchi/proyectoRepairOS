import { apiClient } from './client';
import { Sucursal, Usuario } from '../types';

export async function listarSucursales(): Promise<Sucursal[]> {
  const { data } = await apiClient.get<Sucursal[]>('/sucursales');
  return data;
}

export type SucursalInput = Omit<Sucursal, 'id' | 'activo'>;

export async function crearSucursal(input: SucursalInput): Promise<Sucursal> {
  const { data } = await apiClient.post<Sucursal>('/sucursales', input);
  return data;
}

export async function actualizarSucursal(
  id: number,
  input: Partial<SucursalInput & { activo: boolean }>
): Promise<Sucursal> {
  const { data } = await apiClient.put<Sucursal>(`/sucursales/${id}`, input);
  return data;
}

export async function desactivarSucursal(id: number): Promise<void> {
  await apiClient.delete(`/sucursales/${id}`);
}

export async function listarPermisos(sucursalId: number): Promise<Usuario[]> {
  const { data } = await apiClient.get<Usuario[]>(`/sucursales/${sucursalId}/permisos`);
  return data;
}

export async function otorgarPermiso(sucursalId: number, usuarioId: number): Promise<void> {
  await apiClient.post(`/sucursales/${sucursalId}/permisos`, { usuarioId });
}

export async function revocarPermiso(sucursalId: number, usuarioId: number): Promise<void> {
  await apiClient.delete(`/sucursales/${sucursalId}/permisos/${usuarioId}`);
}
