import { z } from 'zod';
import { passwordSchema } from './usuarioValidators';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const seleccionarSucursalSchema = z.object({
  sucursalId: z.number().int().positive()
});

/**
 * Alta de un taller nuevo desde el registro público.
 *
 * Quien se registra es el dueño del taller: se crea el taller, su usuario
 * administrador y la suscripción en período de prueba, todo en una sola
 * operación. La contraseña usa la misma política que el alta desde el panel.
 */
export const registroSchema = z
  .object({
    nombreTaller: z.string().trim().min(1, 'El nombre del taller es requerido').max(150),
    nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
    apellido: z.string().trim().min(1, 'El apellido es requerido').max(100),
    email: z.string().trim().toLowerCase().email('El email no es válido').max(150),
    password: passwordSchema,
    passwordConfirmacion: z.string().optional()
  })
  .refine((data) => data.passwordConfirmacion === undefined || data.password === data.passwordConfirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirmacion']
  });
