import { z } from 'zod';
import { idPositivo, textoOpcional } from '../../shared/validation/campos';

export const crearSucursalSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  direccion: textoOpcional(255),
  telefono: textoOpcional(50)
});

export const actualizarSucursalSchema = crearSucursalSchema.partial().extend({
  activo: z.boolean().optional()
});

export const otorgarPermisoSchema = z.object({
  usuarioId: idPositivo
});
