import { apiClient } from '@/shared/api/client';
import type { Cliente } from '@/shared/types';

/** Cuerpo que acepta la API para crear o editar un cliente. */
export interface ClienteInput {
  nombre: string;
  apellido: string;
  dniCuit: string | null;
  telefono: string | null;
  email: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  esGremio: boolean;
  nombreGremio: string | null;
  cuentaCorrienteHabilitada: boolean;
}

export async function listarClientes(search?: string): Promise<Cliente[]> {
  const { data } = await apiClient.get<Cliente[]>('/clientes', { params: search ? { search } : undefined });
  return data;
}

export async function crearCliente(input: ClienteInput): Promise<Cliente> {
  const { data } = await apiClient.post<Cliente>('/clientes', input);
  return data;
}

export async function actualizarCliente(id: number, input: Partial<ClienteInput>): Promise<Cliente> {
  const { data } = await apiClient.put<Cliente>(`/clientes/${id}`, input);
  return data;
}

export async function eliminarCliente(id: number): Promise<void> {
  await apiClient.delete(`/clientes/${id}`);
}

/**
 * Anonimiza un cliente para atender un pedido de supresión. Es irreversible:
 * borra sus datos de contacto, credenciales de equipos y firmas, y conserva
 * las órdenes sin vínculo con una persona identificable.
 */
export async function anonimizarCliente(id: number): Promise<{ anonimizadoEn: string }> {
  const { data } = await apiClient.post(`/clientes/${id}/anonimizar`);
  return data;
}
