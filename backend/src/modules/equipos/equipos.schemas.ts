import { z } from 'zod';
import {
  booleanoEnQuery,
  busqueda,
  idEnQuery,
  idPositivo,
  textoOpcional
} from '../../shared/validation/campos';

/** El número de serie va siempre en mayúsculas: así se lee en la caja y en el equipo. */
const serie = z.string().trim().max(150).toUpperCase();

/** Datos de un equipo. Las credenciales llegan en claro y se guardan cifradas. */
export const datosEquipoSchema = z.object({
  tipoEquipoPersonalizadoId: idPositivo,
  marca: textoOpcional(100),
  modelo: textoOpcional(100),
  color: textoOpcional(50),
  numeroSerie: serie.optional(),
  claveDesbloqueo: z.string().optional().nullable(),
  cuentaUsuario: z.string().optional().nullable(),
  cuentaPassword: z.string().optional().nullable()
});

export const crearEquipoSchema = datosEquipoSchema.extend({
  clienteId: idPositivo,
  numeroSerie: serie.min(1, 'El número de serie es requerido')
});

export const actualizarEquipoSchema = crearEquipoSchema.partial();

export const listarEquiposQuery = z.object({
  search: busqueda,
  clienteId: idEnQuery.optional(),
  /** Coincidencia exacta: al cargar un equipo nuevo, para saber si ya existe. */
  numeroSerie: busqueda
});

export const obtenerEquipoQuery = z.object({ reveal: booleanoEnQuery });
