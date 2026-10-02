import { apiClient } from '@/shared/api/client';
import type { RolUsuario, Sucursal, Suscripcion, Taller } from '@/shared/types';

export interface SesionIniciada {
  token: string;
  usuario: { id: number; nombre: string; apellido: string; email: string; rol: RolUsuario };
}

/** El usuario de la sesión con su taller, suscripción y sucursales disponibles. */
export interface Perfil {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  taller: Taller | null;
  suscripcion: Suscripcion | null;
  sucursalActualId: number | null;
  sucursales: Sucursal[];
}

export interface RegistroDatos {
  nombreTaller: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  passwordConfirmacion: string;
}

/** Alta de un taller nuevo. Devuelve el token ya emitido: no hay que loguearse después. */
export async function registrar(datos: RegistroDatos): Promise<SesionIniciada> {
  const { data } = await apiClient.post<SesionIniciada>('/auth/registro', datos);
  return data;
}

export async function login(email: string, password: string): Promise<SesionIniciada> {
  const { data } = await apiClient.post<SesionIniciada>('/auth/login', { email, password });
  return data;
}

/** Segundo paso del login: devuelve un token nuevo con la sucursal elegida. */
export async function seleccionarSucursal(
  sucursalId: number
): Promise<{ token: string; sucursal: Sucursal }> {
  const { data } = await apiClient.post('/auth/seleccionar-sucursal', { sucursalId });
  return data;
}

export async function perfil(): Promise<Perfil> {
  const { data } = await apiClient.get<Perfil>('/auth/me');
  return data;
}
