import { apiClient } from './client';
import { RolUsuario, Sucursal, Suscripcion, Taller } from '../types';

export interface LoginResponse {
  token: string;
  usuario: { id: number; nombre: string; apellido: string; email: string; rol: RolUsuario };
}

export interface MeResponse {
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
export async function registrar(datos: RegistroDatos): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/registro', datos);
  return data;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function seleccionarSucursal(
  sucursalId: number
): Promise<{ token: string; sucursal: Sucursal }> {
  const { data } = await apiClient.post('/auth/seleccionar-sucursal', { sucursalId });
  return data;
}

export async function me(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>('/auth/me');
  return data;
}

export async function misSucursales(): Promise<Sucursal[]> {
  const { data } = await apiClient.get<Sucursal[]>('/sucursales/mis-sucursales');
  return data;
}
