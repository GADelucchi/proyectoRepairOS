import { z } from 'zod';
import { busqueda, emailOpcional, fechaIsoOpcional, textoOpcional } from '../../shared/validation/campos';

/**
 * Única definición de los datos de un cliente. La usan el alta desde Clientes y
 * el alta rápida dentro de una orden nueva, para que ninguno pierda campos.
 */
export const clienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().trim().min(1, 'El apellido es requerido').max(100),
  dniCuit: textoOpcional(20),
  telefono: textoOpcional(50),
  email: emailOpcional,
  fechaNacimiento: fechaIsoOpcional,
  direccion: textoOpcional(255),
  ciudad: textoOpcional(100),
  esGremio: z.boolean().optional().default(false),
  nombreGremio: textoOpcional(255),
  /** Habilitar el fiado es decisión del admin; el controlador valida el rol. */
  cuentaCorrienteHabilitada: z.boolean().optional()
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export const actualizarClienteSchema = clienteSchema.partial();

export const listarClientesQuery = z.object({ search: busqueda });
