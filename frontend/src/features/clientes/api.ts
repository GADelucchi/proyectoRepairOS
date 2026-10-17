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
  ciudad: string | null;
  esGremio: boolean;
  nombreGremio: string | null;
  cuentaCorrienteHabilitada: boolean;
}

export async function listarClientes(search?: string): Promise<Cliente[]> {
  const { data } = await apiClient.get<Cliente[]>('/clientes', { params: search ? { search } : undefined });
  return data;
}

/** Las órdenes del cliente contadas por cómo terminaron, de todas las sucursales. */
export interface ConteoOrdenesCliente {
  total: number;
  enCurso: number;
  reparadas: number;
  noReparadas: number;
  entregadas: number;
  canceladas: number;
}

export interface ResumenCliente {
  cliente: Cliente;
  ordenes: ConteoOrdenesCliente;
  /** Ingreso de su última orden, o null si nunca trajo un equipo. */
  ultimaVisita: string | null;
}

export async function obtenerResumen(id: number): Promise<ResumenCliente> {
  const { data } = await apiClient.get<ResumenCliente>(`/clientes/${id}/resumen`);
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
