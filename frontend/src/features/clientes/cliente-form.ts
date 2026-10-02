import type { Cliente } from '@/shared/types';
import { convertirAFormatoBackend, convertirDesdeBackend } from '@/shared/utils/fechas';
import { textoONull } from '@/shared/utils/texto';
import type { ClienteInput } from './api';

/** Datos de un cliente tal como los edita el usuario (fecha en DD/MM/YYYY). */
export interface ClienteFormData {
  nombre: string;
  apellido: string;
  dniCuit: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  direccion: string;
  esGremio: boolean;
  nombreGremio: string;
  cuentaCorrienteHabilitada: boolean;
}

export const CLIENTE_FORM_VACIO: ClienteFormData = {
  nombre: '',
  apellido: '',
  dniCuit: '',
  telefono: '',
  email: '',
  fechaNacimiento: '',
  direccion: '',
  esGremio: false,
  nombreGremio: '',
  cuentaCorrienteHabilitada: false
};

/** Carga un cliente existente en el formulario. */
export function clienteAFormulario(cliente: Cliente): ClienteFormData {
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    dniCuit: cliente.dniCuit ?? '',
    telefono: cliente.telefono ?? '',
    email: cliente.email ?? '',
    fechaNacimiento: convertirDesdeBackend(cliente.fechaNacimiento),
    direccion: cliente.direccion ?? '',
    esGremio: cliente.esGremio ?? false,
    nombreGremio: cliente.nombreGremio ?? '',
    cuentaCorrienteHabilitada: cliente.cuentaCorrienteHabilitada ?? false
  };
}

/**
 * Convierte el formulario al cuerpo que espera la API. Es el único lugar donde
 * se arma ese payload: Clientes y el alta rápida de una orden mandan lo mismo.
 */
export function formularioAClienteInput(form: ClienteFormData): ClienteInput {
  return {
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    dniCuit: textoONull(form.dniCuit),
    telefono: textoONull(form.telefono),
    email: textoONull(form.email),
    fechaNacimiento: convertirAFormatoBackend(form.fechaNacimiento),
    direccion: textoONull(form.direccion),
    esGremio: form.esGremio,
    nombreGremio: form.esGremio ? textoONull(form.nombreGremio) : null,
    cuentaCorrienteHabilitada: form.cuentaCorrienteHabilitada
  };
}
