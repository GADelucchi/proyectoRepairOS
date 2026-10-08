import { apiClient } from '@/shared/api/client';
import type { ExcesoDelPlan, RolUsuario, Sucursal, Suscripcion, Taller, UsoDelPlan } from '@/shared/types';

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
  /** Null si el plan no limita (prueba, sin plan o el taller de demo). */
  usoDelPlan: UsoDelPlan | null;
  /** Si no es null, el taller no puede operar hasta que un admin lo ajuste al plan. */
  excesoDelPlan: ExcesoDelPlan | null;
  /** Administra la plataforma (todos los talleres), además de su propio taller. */
  esAdminPlataforma: boolean;
  /** Sesión del taller de demostración pública. */
  esDemo: boolean;
  sucursalActualId: number | null;
  sucursales: Sucursal[];
}

export interface RegistroDatos {
  nombreTaller: string;
  pais: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  passwordConfirmacion: string;
}

/**
 * Alta de un taller nuevo. Devuelve el token ya emitido (no hay que loguearse
 * después), salvo que el sistema exija confirmar el email primero.
 */
export async function registrar(
  datos: RegistroDatos
): Promise<SesionIniciada | { verificacionPendiente: true; email: string }> {
  const { data } = await apiClient.post('/auth/registro', datos);
  return data;
}

/** `emailHabilitado: false` = el envío de emails no está configurado y el link no va a llegar. */
export async function recuperarPassword(email: string): Promise<{ emailHabilitado: boolean }> {
  const { data } = await apiClient.post('/auth/recuperar', { email });
  return data;
}

export async function restablecerPassword(
  token: string,
  password: string,
  passwordConfirmacion: string
): Promise<{ email: string }> {
  const { data } = await apiClient.post('/auth/restablecer', { token, password, passwordConfirmacion });
  return data;
}

export async function verificarEmail(token: string): Promise<{ email: string }> {
  const { data } = await apiClient.post('/auth/verificar-email', { token });
  return data;
}

export async function reenviarVerificacion(email: string): Promise<{ emailHabilitado: boolean }> {
  const { data } = await apiClient.post('/auth/reenviar-verificacion', { email });
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
