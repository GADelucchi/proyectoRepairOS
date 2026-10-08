import { apiClient } from '@/shared/api/client';
import type { Notificacion } from '@/shared/types';

/** Los avisos más recientes de quien está en sesión. */
export async function listarNotificaciones(): Promise<Notificacion[]> {
  const { data } = await apiClient.get<Notificacion[]>('/notificaciones');
  return data;
}

export async function contarNoLeidas(): Promise<number> {
  const { data } = await apiClient.get<{ noLeidas: number }>('/notificaciones/contador');
  return data.noLeidas;
}

export async function marcarLeida(id: number): Promise<void> {
  await apiClient.post(`/notificaciones/${id}/leer`);
}

export async function marcarTodasLeidas(): Promise<void> {
  await apiClient.post('/notificaciones/leer-todas');
}
