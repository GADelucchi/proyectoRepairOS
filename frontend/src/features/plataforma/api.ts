import { apiClient } from '@/shared/api/client';
import type { ExcesoDelPlan, Plan, RolUsuario, Suscripcion } from '@/shared/types';

/** Un taller visto desde la administración de la plataforma. */
export interface TallerPlataforma {
  id: number;
  nombre: string;
  createdAt: string;
  usuarios: number;
  sucursales: number;
  ordenes: number;
  ordenesUltimos30: number;
  /** El último uso de la app de cualquiera de sus usuarios. */
  ultimoAcceso: string | null;
  duenoNombre: string | null;
  duenoEmail: string | null;
  esDemo: boolean;
  /** Null: sin suscripción (sin restricción de acceso). */
  suscripcion: Suscripcion | null;
}

export interface UsuarioPlataforma {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  ultimoAccesoAt: string | null;
  createdAt: string;
  tallerId?: number;
  taller?: string;
}

/** En el detalle, `usuarios` y `sucursales` son las listas en vez de los conteos. */
export interface DetalleTaller extends Omit<TallerPlataforma, 'usuarios' | 'sucursales'> {
  usuarios: UsuarioPlataforma[];
  sucursales: { id: number; nombre: string; activo: boolean }[];
}

export interface ResumenPlataforma {
  talleres: number;
  talleresUltimos7: number;
  talleresUltimos30: number;
  usuarios: number;
  usuariosHoy: number;
  usuariosUltimos7: number;
  ordenesUltimos30: number;
  suscripciones: {
    prueba: number;
    activa: number;
    vencida: number;
    cancelada: number;
    porVencer: number;
    sinSuscripcion: number;
  };
  /** Los últimos talleres registrados (sin la demo). */
  recientes: TallerPlataforma[];
}

export interface CambioSuscripcion {
  estado: 'prueba' | 'activa' | 'cancelada';
  planId?: number | null;
  /** YYYY-MM-DD. En `activa`, null = no vence. */
  hasta?: string | null;
}

export async function obtenerResumen(): Promise<ResumenPlataforma> {
  const { data } = await apiClient.get<ResumenPlataforma>('/plataforma/resumen');
  return data;
}

export async function listarTalleres(search?: string): Promise<TallerPlataforma[]> {
  const { data } = await apiClient.get<TallerPlataforma[]>('/plataforma/talleres', {
    params: search ? { search } : undefined
  });
  return data;
}

export async function obtenerTaller(id: number): Promise<DetalleTaller> {
  const { data } = await apiClient.get<DetalleTaller>(`/plataforma/talleres/${id}`);
  return data;
}

/** La suscripción nueva y, si el plan quedó chico, cuánto se pasa el taller. */
export type ResultadoSuscripcion = Suscripcion & { exceso: ExcesoDelPlan | null };

export async function actualizarSuscripcion(
  tallerId: number,
  cambio: CambioSuscripcion
): Promise<ResultadoSuscripcion> {
  const { data } = await apiClient.put<ResultadoSuscripcion>(
    `/plataforma/talleres/${tallerId}/suscripcion`,
    cambio
  );
  return data;
}

export async function listarUsuarios(search?: string): Promise<UsuarioPlataforma[]> {
  const { data } = await apiClient.get<UsuarioPlataforma[]>('/plataforma/usuarios', {
    params: search ? { search } : undefined
  });
  return data;
}

export async function listarPlanes(): Promise<Plan[]> {
  const { data } = await apiClient.get<Plan[]>('/plataforma/planes');
  return data;
}
