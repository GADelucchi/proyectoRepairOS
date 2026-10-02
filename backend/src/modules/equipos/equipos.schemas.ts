import { z } from 'zod';
import {
  booleanoEnQuery,
  busqueda,
  idEnQuery,
  idPositivo,
  textoOpcional
} from '../../shared/validation/campos';

/** Datos de un equipo. Las credenciales llegan en claro y se guardan cifradas. */
export const datosEquipoSchema = z.object({
  tipoEquipoPersonalizadoId: idPositivo,
  marca: textoOpcional(100),
  modelo: textoOpcional(100),
  color: textoOpcional(50),
  numeroSerie: z.string().trim().max(150).optional(),
  claveDesbloqueo: z.string().optional().nullable(),
  cuentaUsuario: z.string().optional().nullable(),
  cuentaPassword: z.string().optional().nullable()
});

export const crearEquipoSchema = datosEquipoSchema.extend({
  clienteId: idPositivo,
  numeroSerie: z.string().trim().min(1, 'El número de serie es requerido').max(150)
});

export const actualizarEquipoSchema = crearEquipoSchema.partial();

export const listarEquiposQuery = z.object({
  search: busqueda,
  clienteId: idEnQuery.optional()
});

export const obtenerEquipoQuery = z.object({ reveal: booleanoEnQuery });
