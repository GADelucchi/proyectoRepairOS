import { z } from 'zod';

export const crearEquipoSchema = z.object({
  clienteId: z.number().int().positive(),
  tipoEquipoPersonalizadoId: z.number().int().positive(),
  marca: z.string().optional().nullable(),
  modelo: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  numeroSerie: z.string().trim().min(1, 'El número de serie es requerido'),
  claveDesbloqueo: z.string().optional().nullable(),
  cuentaUsuario: z.string().optional().nullable(),
  cuentaPassword: z.string().optional().nullable()
});

export const actualizarEquipoSchema = crearEquipoSchema.partial();
