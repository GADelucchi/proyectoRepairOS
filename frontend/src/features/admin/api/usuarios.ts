import { apiClient } from '@/shared/api/client';
import type { RolUsuario, Usuario } from '@/shared/types';

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data } = await apiClient.get<Usuario[]>('/usuarios');
  return data;
}

export interface CrearUsuarioInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  passwordConfirmacion: string;
  rol: RolUsuario;
}

export async function crearUsuario(input: CrearUsuarioInput): Promise<Usuario> {
  const { data } = await apiClient.post<Usuario>('/usuarios', input);
  return data;
}

export async function actualizarUsuario(
  id: number,
  input: Partial<Pick<Usuario, 'nombre' | 'apellido' | 'email' | 'rol' | 'activo'>>
): Promise<Usuario> {
  const { data } = await apiClient.put<Usuario>(`/usuarios/${id}`, input);
  return data;
}

export async function cambiarPassword(
  id: number,
  password: string,
  passwordConfirmacion: string
): Promise<void> {
  await apiClient.put(`/usuarios/${id}/password`, { password, passwordConfirmacion });
}

export async function desactivarUsuario(id: number): Promise<void> {
  await apiClient.delete(`/usuarios/${id}`);
}
