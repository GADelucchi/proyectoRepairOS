import { z } from 'zod';

/**
 * Política de contraseñas: mínimo 8 caracteres, con al menos una mayúscula,
 * una minúscula y un número. Se valida acá y no solo en el formulario, para que
 * también aplique a cualquier cliente que pegue contra la API directamente.
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede superar los 128 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número');

/** Exige que la confirmación coincida con la contraseña. */
const conConfirmacion = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.refine(
    (data: any) => data.passwordConfirmacion === undefined || data.password === data.passwordConfirmacion,
    {
      message: 'Las contraseñas no coinciden',
      path: ['passwordConfirmacion']
    }
  );

export const crearUsuarioSchema = conConfirmacion(
  z.object({
    nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
    apellido: z.string().trim().min(1, 'El apellido es requerido').max(100),
    email: z.string().trim().email('El email no es válido').max(150),
    password: passwordSchema,
    passwordConfirmacion: z.string().optional(),
    rol: z.enum(['admin', 'tecnico']).default('tecnico')
  })
);

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  apellido: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email('El email no es válido').max(150).optional(),
  rol: z.enum(['admin', 'tecnico']).optional(),
  activo: z.boolean().optional()
});

export const cambiarPasswordSchema = conConfirmacion(
  z.object({
    password: passwordSchema,
    passwordConfirmacion: z.string().optional()
  })
);
