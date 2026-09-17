import { apiClient } from './client';
import { Cliente } from '../types';
import { ClienteFormData } from '../components/ClienteFormFields';
import { convertirAFormatoBackend } from '../utils/dateFormat';

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

const oNull = (valor: string) => {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
};

/**
 * Convierte el formulario de cliente al cuerpo que espera la API.
 * Es el único lugar donde se arma ese payload, así que la pantalla de Clientes
 * y el alta rápida desde una orden mandan siempre los mismos campos.
 */
export function formularioAClienteInput(form: ClienteFormData): ClienteInput {
  return {
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    dniCuit: oNull(form.dniCuit),
    telefono: oNull(form.telefono),
    email: oNull(form.email),
    fechaNacimiento: convertirAFormatoBackend(form.fechaNacimiento),
    direccion: oNull(form.direccion),
    esGremio: form.esGremio,
    nombreGremio: form.esGremio ? oNull(form.nombreGremio) : null,
    cuentaCorrienteHabilitada: form.cuentaCorrienteHabilitada
  };
}

export async function listarClientes(search?: string): Promise<Cliente[]> {
  const { data } = await apiClient.get<Cliente[]>('/clientes', { params: search ? { search } : undefined });
  return data;
}

export async function obtenerCliente(id: number): Promise<Cliente> {
  const { data } = await apiClient.get<Cliente>(`/clientes/${id}`);
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
