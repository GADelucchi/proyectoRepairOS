import { z } from 'zod';

export const crearSucursalSchema = z.object({
  nombre: z.string().min(2),
  direccion: z.string().optional().nullable(),
  telefono: z.string().optional().nullable()
});

export const actualizarSucursalSchema = crearSucursalSchema.partial().extend({
  activo: z.boolean().optional()
});

export const otorgarPermisoSchema = z.object({
  usuarioId: z.number().int().positive()
});
